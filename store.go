package main

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strconv"
	"sync"
	"time"
)

// All money values are whole Iraqi dinars (IQD has no fractions in daily use),
// stored as int64 so totals never suffer from floating point rounding.

type Product struct {
	CostPrice *int64   `json:"costPrice,omitempty"`
	ID        string   `json:"id"`
	Name      string   `json:"name"`
	Price     int64    `json:"price"`
	Stock     int64    `json:"stock"`
	Images    []string `json:"images"`
	CreatedAt string   `json:"createdAt"`
	UpdatedAt string   `json:"updatedAt"`
}

type Customer struct {
	ID        string `json:"id"`
	Name      string `json:"name"`
	Phone     string `json:"phone"`
	Address   string `json:"address"`
	CreatedAt string `json:"createdAt"`
}

type InvoiceItem struct {
	CostPrice *int64 `json:"costPrice,omitempty"`
	ProductID string `json:"productId"`
	Name      string `json:"name"`
	Price     int64  `json:"price"`
	Qty       int64  `json:"qty"`
	Total     int64  `json:"total"`
}

type Invoice struct {
	Returns         []InvoiceReturn `json:"returns,omitempty"`
	ID              string          `json:"id"`
	Number          int64           `json:"number"` // running order of all invoices, never reused
	Code            string          `json:"code"`   // printed number, e.g. INV-HS-2026-00001
	Year            int             `json:"year"`
	Seq             int64           `json:"seq"` // position within its year, starts at 1
	Date            string          `json:"date"`
	CustomerID      string          `json:"customerId"`
	CustomerName    string          `json:"customerName"`
	CustomerPhone   string          `json:"customerPhone"`
	CustomerAddress string          `json:"customerAddress"`
	Items           []InvoiceItem   `json:"items"`
	Total           int64           `json:"total"`
}

// Saved with stock/invoice changes. Entries remain after invoice deletion, so
// delayed checkout retries cannot create a second sale or reuse a cancelled key.
type SaleReceipt struct {
	Hash      string `json:"hash"`
	InvoiceID string `json:"invoiceId,omitempty"`
	Code      string `json:"code,omitempty"`
	Cancelled bool   `json:"cancelled,omitempty"`
}

type Settings struct {
	TopbarColor   string `json:"topbarColor,omitempty"`
	TrackProfit   bool   `json:"trackProfit,omitempty"`
	Theme         string `json:"theme"`    // "light" or "dark"
	Language      string `json:"language"` // "en" or "ar"
	StoreName     string `json:"storeName"`
	ShowStoreName bool   `json:"showStoreName"`
	Logo          string `json:"logo"`      // file name inside data/images
	LogoSize      int    `json:"logoSize"`  // logo height on the invoice, in px
	LogoAlign     string `json:"logoAlign"` // "start", "center" or "end"
	InvoiceTitle  string `json:"invoiceTitle"`
	Header        string `json:"header"`
	Footer        string `json:"footer"`
	Paper         string `json:"paper"`       // "a4" or "receipt" (80 mm)
	LowStock      int64  `json:"lowStock"`    // warn when stock is at or below this
	AccentColor   string `json:"accentColor"` // text accent on the invoice, "#rrggbb"
	RowColor      string `json:"rowColor"`    // fill of the even table rows on A4, "#rrggbb"
	ShowPaid      bool   `json:"showPaid"`    // print "PAID" under the total
	ShowDate      bool   `json:"showDate"`
	ShowTime      bool   `json:"showTime"`
}

type DB struct {
	Version     int   `json:"version"`
	NextInvoice int64 `json:"nextInvoice"`
	// Last sequence number used in each year ("2026": 12). Kept even when
	// invoices are deleted, so a printed number is never given out twice.
	YearCounters map[string]int64       `json:"yearCounters"`
	Settings     Settings               `json:"settings"`
	Products     []Product              `json:"products"`
	Customers    []Customer             `json:"customers"`
	Invoices     []Invoice              `json:"invoices"`
	SaleRequests map[string]SaleReceipt `json:"saleRequests,omitempty"`
}

const (
	maxPrice           = 1_000_000_000 // 1 billion IQD per piece
	maxQty             = 1_000_000
	maxTotal           = 1_000_000_000_000_000 // 10^15 IQD per invoice
	maxLines           = 500
	maxImages          = 10
	maxInvoiceSequence = 999_999_999
)

func defaultSettings() Settings {
	return Settings{
		TopbarColor:   "#714b67",
		Theme:         "light",
		Language:      "en",
		StoreName:     "My Store",
		ShowStoreName: true,
		LogoSize:      80,
		LogoAlign:     "center",
		InvoiceTitle:  "",
		Paper:         "a4",
		LowStock:      5,
		AccentColor:   "#714b67",
		RowColor:      "#f3edf2",
		ShowPaid:      true,
		ShowDate:      true,
		ShowTime:      true,
	}
}

// Store keeps the whole database in memory and writes it to data/db.json
// after every change. A small shop never gets close to the size where this
// becomes slow, and one JSON file is easy to copy, back up and read.
type Store struct {
	mu           sync.Mutex
	dir          string
	imagesDir    string
	file         string
	db           DB
	generation   string
	revision     uint64
	transfers    map[string]*backupTransfer
	importBroken bool
	backupWork   chan struct{}
}

func OpenStore(dir string) (*Store, error) {
	var err error
	dir, err = canonicalDataDirectory(dir)
	if err != nil {
		return nil, err
	}
	if err := recoverImport(dir); err != nil {
		return nil, err
	}
	if err := cleanupAbandonedImports(dir); err != nil {
		return nil, err
	}
	s := &Store{
		dir:        dir,
		imagesDir:  filepath.Join(dir, "images"),
		file:       filepath.Join(dir, "db.json"),
		generation: newID(), transfers: map[string]*backupTransfer{},
		backupWork: make(chan struct{}, 1),
	}
	for _, d := range []string{dir, s.imagesDir, filepath.Join(dir, "backups")} {
		if err := os.MkdirAll(d, 0o755); err != nil {
			return nil, err
		}
	}
	raw, err := os.ReadFile(s.file)
	switch {
	case errors.Is(err, os.ErrNotExist):
		s.db = DB{Version: 1, NextInvoice: 1, Settings: defaultSettings()}
		if err := s.saveLocked(); err != nil {
			return nil, err
		}
	case err != nil:
		return nil, err
	default:
		// Start from defaults so settings added in later versions get a value.
		s.db = DB{Settings: defaultSettings()}
		if err := json.Unmarshal(stripBOM(raw), &s.db); err != nil {
			return nil, fmt.Errorf("db.json is damaged (%v); restore a copy from %s", err, filepath.Join(dir, "backups"))
		}
		if s.db.NextInvoice < 1 {
			s.db.NextInvoice = 1
		}
		for _, inv := range s.db.Invoices {
			if inv.Number >= s.db.NextInvoice {
				s.db.NextInvoice = inv.Number + 1
			}
		}
	}
	s.normalize()
	if s.addMissingCodes() {
		if err := s.saveLocked(); err != nil {
			return nil, err
		}
	}
	s.sweepImages()
	os.Remove(filepath.Join(dir, ".inventory-staging"))
	os.Remove(filepath.Join(dir, ".import-manifest.json"))
	return s, nil
}

const invoicePrefix = "INV-HS-"

// Moving the sequence forward also reserves the skipped range. A counter is
// never moved backward, including after invoice deletion or a restart.
func (db *DB) setNextInvoiceNumber(year int, next int64) error {
	if next < 1 || next > maxInvoiceSequence {
		return bad("err.invoiceNumber")
	}
	key := strconv.Itoa(year)
	if next <= db.YearCounters[key] {
		return &apiError{409, "err.invoiceNumberUsed"}
	}
	db.YearCounters[key] = next - 1
	return nil
}

// invoiceCode gives the printed invoice number, e.g. INV-HS-2026-00001.
// The number has at least five digits and simply grows past 99999.
func invoiceCode(year int, seq int64) string {
	return fmt.Sprintf("%s%d-%05d", invoicePrefix, year, seq)
}

// nextCode takes the next sequence number for the year of t.
func (db *DB) nextCode(t time.Time) (code string, year int, seq int64) {
	year = t.Year()
	key := strconv.Itoa(year)
	seq = db.YearCounters[key] + 1
	db.YearCounters[key] = seq
	return invoiceCode(year, seq), year, seq
}

// addMissingCodes gives invoices saved by older versions (which only had a
// plain number) a code in the new style, in their original order, and makes
// sure the year counters are never below a code already in use.
func (s *Store) addMissingCodes() bool {
	changed := false
	for _, inv := range s.db.Invoices {
		if inv.Code != "" {
			key := strconv.Itoa(inv.Year)
			if inv.Seq > s.db.YearCounters[key] {
				s.db.YearCounters[key] = inv.Seq
				changed = true
			}
		}
	}
	order := make([]int, 0)
	for i, inv := range s.db.Invoices {
		if inv.Code == "" {
			order = append(order, i)
		}
	}
	sort.Slice(order, func(a, b int) bool { return s.db.Invoices[order[a]].Number < s.db.Invoices[order[b]].Number })
	for _, i := range order {
		inv := &s.db.Invoices[i]
		t, err := time.Parse(time.RFC3339, inv.Date)
		if err != nil {
			t = time.Now()
		}
		inv.Code, inv.Year, inv.Seq = s.db.nextCode(t)
		changed = true
	}
	return changed
}

func stripBOM(b []byte) []byte {
	return bytes.TrimPrefix(b, []byte{0xEF, 0xBB, 0xBF})
}

// normalize makes sure lists are never null in the JSON sent to the browser.
func (s *Store) normalize() {
	if s.db.Products == nil {
		s.db.Products = []Product{}
	}
	if s.db.Customers == nil {
		s.db.Customers = []Customer{}
	}
	if s.db.YearCounters == nil {
		s.db.YearCounters = map[string]int64{}
	}
	if s.db.Invoices == nil {
		s.db.Invoices = []Invoice{}
	}
	for i := range s.db.Products {
		if s.db.Products[i].Images == nil {
			s.db.Products[i].Images = []string{}
		}
	}
}

// saveLocked flushes a complete temporary file before replacing db.json.
// Errors before replacement leave the previous database file intact.
// Once per day it also keeps a copy of the previous file in data/backups.
func (s *Store) saveLocked() error {
	s.normalize()
	s.dailyBackup()
	data, err := json.MarshalIndent(s.db, "", "  ")
	if err != nil {
		return err
	}
	tmp := s.file + ".tmp"
	if err := writeSyncedFile(tmp, data); err != nil {
		return err
	}
	return os.Rename(tmp, s.file)
}

func (s *Store) dailyBackup() {
	backupDir := filepath.Join(s.dir, "backups")
	name := filepath.Join(backupDir, "db-"+time.Now().Format("2006-01-02")+".json")
	if _, err := os.Stat(name); err == nil {
		return
	}
	raw, err := os.ReadFile(s.file)
	if err != nil {
		return
	}
	if os.WriteFile(name, raw, 0o644) != nil {
		return
	}
	// Keep the 30 newest daily backups.
	entries, _ := filepath.Glob(filepath.Join(backupDir, "db-*.json"))
	sort.Strings(entries)
	for len(entries) > 30 {
		os.Remove(entries[0])
		entries = entries[1:]
	}
}

// sweepImages removes picture files that nothing points to any more, for
// example pictures picked in the product form that was then cancelled.
// It only runs at start up, when no form can be open.
func (s *Store) sweepImages() {
	used := s.usedImages()
	entries, err := os.ReadDir(s.imagesDir)
	if err != nil {
		return
	}
	for _, e := range entries {
		if !e.IsDir() && !used[e.Name()] {
			os.Remove(filepath.Join(s.imagesDir, e.Name()))
		}
	}
}

func (s *Store) usedImages() map[string]bool {
	used := map[string]bool{}
	if s.db.Settings.Logo != "" {
		used[s.db.Settings.Logo] = true
	}
	for _, p := range s.db.Products {
		for _, img := range p.Images {
			used[img] = true
		}
	}
	return used
}

// removeImagesIfUnused deletes the given picture files unless another
// product or the logo still uses them.
func (s *Store) removeImagesIfUnused(names []string) {
	used := s.usedImages()
	for _, n := range names {
		if n != "" && !used[n] && validImageName(n) {
			os.Remove(filepath.Join(s.imagesDir, n))
		}
	}
}
