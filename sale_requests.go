package main

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"net/http"
	"regexp"
)

var saleRequestIDRe = regexp.MustCompile(`^[0-9a-f]{32}$`)
var saleRequestHashRe = regexp.MustCompile(`^[0-9a-f]{64}$`)
var saleInvoiceIDRe = regexp.MustCompile(`^[0-9a-f]{16}$`)

func saleRequestHash(request saleRequest) string {
	request.RequestID = ""
	raw, _ := json.Marshal(request)
	hash := sha256.Sum256(raw)
	return hex.EncodeToString(hash[:])
}

func saleInvoiceExists(db *DB, id string) bool {
	for _, invoice := range db.Invoices {
		if invoice.ID == id {
			return true
		}
	}
	return false
}

func (s *Store) saleAttemptStatus(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if !saleRequestIDRe.MatchString(id) {
		backupError(w, bad("err.saleRequest"))
		return
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	receipt, exists := s.db.SaleRequests[id]
	if !exists {
		backupError(w, notFound())
		return
	}
	status := "completed"
	if receipt.Cancelled {
		status = "cancelled"
	} else if !saleInvoiceExists(&s.db, receipt.InvoiceID) {
		status = "deleted"
	}
	writeJSON(w, http.StatusOK, map[string]any{"status": status, "invoiceId": receipt.InvoiceID, "code": receipt.Code})
}

// Cancellation is serialized with checkout. If a late original request arrives
// afterward, its durable cancelled receipt stops it from creating a sale.
func (s *Store) cancelSaleAttempt(w http.ResponseWriter, r *http.Request) {
	var request saleRequest
	if err := readJSON(r, &request); err != nil {
		backupError(w, err)
		return
	}
	if !saleRequestIDRe.MatchString(request.RequestID) {
		backupError(w, bad("err.saleRequest"))
		return
	}
	hash := saleRequestHash(request)
	outcome := &mutationOutcome{fields: map[string]any{}}
	s.mutateWithOutcome(w, r, func(db *DB) error {
		if receipt, exists := db.SaleRequests[request.RequestID]; exists {
			if receipt.Hash != hash {
				return &apiError{http.StatusConflict, "err.saleRequestChanged"}
			}
			outcome.replay = true
			if !receipt.Cancelled {
				if !saleInvoiceExists(db, receipt.InvoiceID) {
					return &apiError{http.StatusConflict, "err.saleDeleted"}
				}
				outcome.fields["invoiceId"] = receipt.InvoiceID
				return nil
			}
		} else {
			if db.SaleRequests == nil {
				db.SaleRequests = map[string]SaleReceipt{}
			}
			db.SaleRequests[request.RequestID] = SaleReceipt{Hash: hash, Cancelled: true}
		}
		outcome.fields["cancelled"] = true
		return nil
	}, outcome)
}
