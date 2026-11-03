package main

import (
	"encoding/json"
	"fmt"
	"net/http"
	"time"
)

type ReturnItem struct {
	Index int   `json:"index"`
	Qty   int64 `json:"qty"`
}

type InvoiceReturn struct {
	ID      string       `json:"id"`
	Date    string       `json:"date"`
	Items   []ReturnItem `json:"items"`
	Restock bool         `json:"restock"`
	Total   int64        `json:"total"`
}

// Validate the ledger on import too: refunds must never exceed sold quantities.
func validateInvoiceReturns(inv Invoice) error {
	quantities := make([]int64, len(inv.Items))
	seen := map[string]bool{}
	for _, ret := range inv.Returns {
		if !saleRequestIDRe.MatchString(ret.ID) || seen[ret.ID] || len(ret.Items) == 0 || len(ret.Items) > len(inv.Items) {
			return fmt.Errorf("invalid return record")
		}
		seen[ret.ID] = true
		if _, err := time.Parse(time.RFC3339, ret.Date); err != nil {
			return fmt.Errorf("invalid return date")
		}
		lines := map[int]bool{}
		var total int64
		for _, item := range ret.Items {
			if item.Index < 0 || item.Index >= len(inv.Items) || item.Qty < 1 || lines[item.Index] {
				return fmt.Errorf("invalid return item")
			}
			lines[item.Index] = true
			original := inv.Items[item.Index]
			if item.Qty > original.Qty-quantities[item.Index] {
				return fmt.Errorf("return quantity exceeds sale")
			}
			quantities[item.Index] += item.Qty
			total += original.Price * item.Qty
		}
		if ret.Total != total {
			return fmt.Errorf("incorrect refund total")
		}
	}
	return nil
}

func (s *Store) returnInvoice(w http.ResponseWriter, r *http.Request) {
	var in struct {
		RequestID string       `json:"requestId"`
		Items     []ReturnItem `json:"items"`
		Restock   bool         `json:"restock"`
	}
	if err := readJSON(r, &in); err != nil || !saleRequestIDRe.MatchString(in.RequestID) || len(in.Items) == 0 || len(in.Items) > maxLines {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "err.badReturn"})
		return
	}
	outcome := &mutationOutcome{fields: map[string]any{}}
	s.mutateWithOutcome(w, r, func(db *DB) error {
		for i := range db.Invoices {
			inv := &db.Invoices[i]
			if inv.ID != r.PathValue("id") {
				continue
			}
			for _, previous := range inv.Returns {
				if previous.ID != in.RequestID {
					continue
				}
				a, _ := json.Marshal(previous.Items)
				b, _ := json.Marshal(in.Items)
				if string(a) != string(b) || previous.Restock != in.Restock {
					return &apiError{409, "err.returnChanged"}
				}
				outcome.replay = true
				return nil
			}
			ret := InvoiceReturn{ID: in.RequestID, Date: now(), Items: in.Items, Restock: in.Restock}
			for _, item := range in.Items {
				if item.Index < 0 || item.Index >= len(inv.Items) || item.Qty < 1 || item.Qty > inv.Items[item.Index].Qty {
					return bad("err.badReturn")
				}
				ret.Total += inv.Items[item.Index].Price * item.Qty
			}
			inv.Returns = append(inv.Returns, ret)
			if err := validateInvoiceReturns(*inv); err != nil {
				return &apiError{409, "err.badReturn"}
			}
			if in.Restock {
				for _, item := range in.Items {
					found := false
					for j := range db.Products {
						p := &db.Products[j]
						if p.ID != inv.Items[item.Index].ProductID {
							continue
						}
						if p.Stock > maxQty-item.Qty {
							return bad("err.restockLimit")
						}
						p.Stock += item.Qty
						p.UpdatedAt = ret.Date
						found = true
						break
					}
					if !found {
						return bad("err.returnProductGone")
					}
				}
			}
			return nil
		}
		return notFound()
	}, outcome)
}
