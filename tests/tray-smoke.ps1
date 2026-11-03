param([string]$ExecutablePath = $env:INVENTORY_TEST_EXE)
$ErrorActionPreference = 'Stop'
$projectRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$testRoot = Join-Path $env:TEMP ('inventory-tray-' + [Guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $testRoot | Out-Null
$copiedData = Join-Path $testRoot 'data'
New-Item -ItemType Directory -Path $copiedData | Out-Null
[System.IO.File]::WriteAllText((Join-Path $copiedData 'db.json'), '{"version":1,"nextInvoice":1,"settings":{},"products":[],"customers":[],"invoices":[]}', [System.Text.UTF8Encoding]::new($false))
$beforeHash = (Get-FileHash -LiteralPath (Join-Path $copiedData 'db.json')).Hash
$packageVersion = ([System.IO.File]::ReadAllText((Join-Path $projectRoot 'VERSION'))).Trim()
$executable = if ($ExecutablePath) { [System.IO.Path]::GetFullPath($ExecutablePath) } else { Join-Path $projectRoot ('dist\Inventory Management System ' + $packageVersion + '\Inventory Management System ' + $packageVersion + '.exe') }
$bytes = [IO.File]::ReadAllBytes($executable)
$peOffset = [BitConverter]::ToInt32($bytes, 0x3c)
$subsystem = [BitConverter]::ToUInt16($bytes, $peOffset + 24 + 68)
if ($subsystem -ne 2) { throw 'Executable still uses the console subsystem' }
Add-Type -TypeDefinition @'
using System;
using System.Text;
using System.Runtime.InteropServices;
public static class InventoryTrayCheck {
  [DllImport("user32.dll", CharSet=CharSet.Unicode)] public static extern IntPtr FindWindowEx(IntPtr parent, IntPtr after, string cls, string title);
  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr window, out uint pid);
  [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr window);
  [DllImport("user32.dll", CharSet=CharSet.Unicode)] public static extern int GetWindowText(IntPtr window, StringBuilder title, int count);
  [DllImport("user32.dll")] public static extern bool PostMessage(IntPtr window, uint message, UIntPtr wParam, IntPtr lParam);
  [DllImport("user32.dll")] public static extern IntPtr SendMessage(IntPtr window, uint message, UIntPtr wParam, IntPtr lParam);
  [DllImport("user32.dll")] public static extern int GetMenuItemCount(IntPtr menu);
  [DllImport("user32.dll", CharSet=CharSet.Unicode)] public static extern int GetMenuString(IntPtr menu, uint item, StringBuilder text, int count, uint flags);
  public static IntPtr WindowForProcess(string cls, uint pid) {
    IntPtr window = IntPtr.Zero;
    while ((window = FindWindowEx(IntPtr.Zero, window, cls, null)) != IntPtr.Zero) {
      uint candidate; GetWindowThreadProcessId(window, out candidate);
      if (candidate == pid) return window;
    }
    return IntPtr.Zero;
  }
}
'@
function Wait-For($predicate, $label) {
  $deadline = [DateTime]::UtcNow.AddSeconds(15)
  do {
    $value = & $predicate
    if ($value -is [IntPtr]) { if ($value.ToInt64() -ne 0) { return $value } } elseif ($value) { return $value }
    Start-Sleep -Milliseconds 50
  } while ([DateTime]::UtcNow -lt $deadline)
  throw ('Timed out: ' + $label)
}
function Unused-Port {
  $listener = [Net.Sockets.TcpListener]::new([Net.IPAddress]::Loopback, 0)
  $listener.Start()
  $selectedPort = $listener.LocalEndpoint.Port
  $listener.Stop()
  return $selectedPort
}
$testPort = Unused-Port
$url = 'http://127.0.0.1:' + $testPort
$arguments = @('-port', $testPort, '-data', ('"' + $copiedData + '"'), '-no-browser')
$appProcess = $null
$window = [IntPtr]::Zero
$tcp = $null
try {
  $appProcess = Start-Process -FilePath $executable -ArgumentList $arguments -WindowStyle Hidden -PassThru
  $window = Wait-For { [InventoryTrayCheck]::WindowForProcess('InventoryAppTrayWindow', $appProcess.Id) } 'tray window creation'
  if ([InventoryTrayCheck]::IsWindowVisible($window)) { throw 'Tray owner window is visible' }
  Wait-For { try { (Invoke-RestMethod -Uri ($url + '/api/ping') -TimeoutSec 1).app -eq 'inventory-app' } catch { $false } } 'local server' | Out-Null
  $secondProcess = Start-Process -FilePath $executable -ArgumentList $arguments -WindowStyle Hidden -PassThru
  if (-not $secondProcess.WaitForExit(10000)) { $secondProcess.Kill(); throw 'Second launch did not reuse running app' }
  if ($secondProcess.ExitCode -ne 0) { throw 'Second launch failed' }
  $snapshot = Invoke-RestMethod -Uri ($url + '/api/data')
  $expectedVersion = ([System.IO.File]::ReadAllText((Join-Path $projectRoot 'VERSION'))).Trim()
  if ($snapshot.version -ne $expectedVersion) { throw 'Wrong application version in API' }
  $title = [Text.StringBuilder]::new(200)
  [InventoryTrayCheck]::GetWindowText($window, $title, $title.Capacity) | Out-Null
  if ($title.ToString() -ne ('Inventory Management System ' + $expectedVersion)) { throw ('Wrong tray title: ' + $title) }
  if ((Get-FileHash -LiteralPath (Join-Path $copiedData 'db.json')).Hash -ne $beforeHash) { throw 'Startup rewrote the copied original database' }
  [InventoryTrayCheck]::PostMessage($window, 0x8001, [UIntPtr]::Zero, [IntPtr]0x1007b) | Out-Null
  $menuWindow = Wait-For { [InventoryTrayCheck]::WindowForProcess('#32768', $appProcess.Id) } 'right-click menu'
  $menu = Wait-For { [InventoryTrayCheck]::SendMessage($menuWindow, 0x1e1, [UIntPtr]::Zero, [IntPtr]::Zero) } 'menu handle'
  $labels = @()
  for ($i = 0; $i -lt [InventoryTrayCheck]::GetMenuItemCount($menu); $i++) {
    $text = [Text.StringBuilder]::new(100)
    [InventoryTrayCheck]::GetMenuString($menu, $i, $text, 100, 0x400) | Out-Null
    if ($text.Length) { $labels += $text.ToString() }
  }
  if (($labels -join ',') -ne 'Open app,Exit') { throw ('Unexpected tray menu: ' + ($labels -join ',')) }
  [InventoryTrayCheck]::PostMessage($window, 0x1f, [UIntPtr]::Zero, [IntPtr]::Zero) | Out-Null
  Start-Sleep -Milliseconds 100
  # Keep a valid product-save request in flight while Exit is selected.
  $tcp = [Net.Sockets.TcpClient]::new('127.0.0.1', $testPort)
  $tcp.ReceiveTimeout = 5000
  $stream = $tcp.GetStream()
  $productName = 'Tray shutdown test ' + [Guid]::NewGuid().ToString('N')
  $body = [Text.Encoding]::UTF8.GetBytes((@{name=$productName;price=1;stock=1;images=@()} | ConvertTo-Json -Compress))
  $header = [Text.Encoding]::ASCII.GetBytes(('POST /api/products HTTP/1.1' + "`r`n" + 'Host: 127.0.0.1:' + $testPort + "`r`n" + 'X-Inventory-Generation: ' + $snapshot.generation + "`r`n" + 'Content-Type: application/json' + "`r`n" + 'Content-Length: ' + $body.Length + "`r`n" + 'Connection: close' + "`r`n`r`n"))
  $stream.Write($header, 0, $header.Length)
  $stream.Write($body, 0, $body.Length - 1)
  Start-Sleep -Milliseconds 200
  [InventoryTrayCheck]::PostMessage($window, 0x111, [UIntPtr]::new([uint64]2), [IntPtr]::Zero) | Out-Null
  Start-Sleep -Milliseconds 300
  $appProcess.Refresh()
  if ($appProcess.HasExited) { throw 'Exit interrupted an active save request' }
  $stream.Write($body, $body.Length - 1, 1)
  $reader = [IO.StreamReader]::new($stream)
  $answer = $reader.ReadToEnd()
  if (-not $answer.StartsWith('HTTP/1.1 200')) { throw ('Pending save failed: ' + $answer) }
  $tcp.Dispose()
  $tcp = $null
  if (-not $appProcess.WaitForExit(10000)) { throw 'Tray Exit did not terminate the server' }
  if ($appProcess.ExitCode -ne 0) { throw ('Tray app exit code: ' + $appProcess.ExitCode) }
  $saved = Get-Content -Raw -Encoding UTF8 -LiteralPath (Join-Path $copiedData 'db.json') | ConvertFrom-Json
  if (-not ($saved.products | Where-Object name -eq $productName)) { throw 'Pending product was not saved before exit' }
  # Restart against that same copied folder, then exit through the web API.
  $appProcess = Start-Process -FilePath $executable -ArgumentList $arguments -WindowStyle Hidden -PassThru
  $window = Wait-For { [InventoryTrayCheck]::WindowForProcess('InventoryAppTrayWindow', $appProcess.Id) } 'tray restart'
  Wait-For { try { (Invoke-RestMethod -Uri ($url + '/api/data') -TimeoutSec 1).db.products | Where-Object name -eq $productName } catch { $false } } 'saved product after restart' | Out-Null
  $exitSnapshot = Invoke-RestMethod -Uri ($url + '/api/data')
  $exitAnswer = Invoke-RestMethod -Uri ($url + '/api/exit') -Method Post -ContentType 'application/json' -Headers @{'X-Inventory-Generation'=$exitSnapshot.generation} -Body '{}'
  if (-not $exitAnswer.closed) { throw 'Web Exit did not confirm shutdown' }
  if (-not $appProcess.WaitForExit(10000)) { throw 'Web Exit did not terminate the tray app' }
  [PSCustomObject]@{Passed=$true;WindowsSubsystem=$subsystem;TrayMenu=($labels -join ', ');CopiedDatabaseUnchangedOnStartup=$true;GracefulSaveOnExit=$true;RestartPersistence=$true;Artifacts=$testRoot} | ConvertTo-Json
} finally {
  if ($tcp) { $tcp.Dispose() }
  if ($appProcess -and -not $appProcess.HasExited) {
    if ($window -ne [IntPtr]::Zero) { [InventoryTrayCheck]::PostMessage($window, 0x10, [UIntPtr]::Zero, [IntPtr]::Zero) | Out-Null }
    if (-not $appProcess.WaitForExit(2000)) { $appProcess.Kill() }
  }
}







