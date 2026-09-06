// Package main implements the PaperBoy command-line client.
//
// The CLI is a single self-contained binary with no third-party
// dependencies. Tenant and environment always come from the bearer key
// (PAPERBOY_API_KEY or --api-key); the server base URL comes from
// PAPERBOY_URL or --endpoint and defaults to http://localhost:3000.
//
// Usage:
//
//	paperboy <resource> <action> [id...] [--set key=value] [--query k=v]
//	    [--json '{"raw": 1}'] [--file ./contacts.csv]
//
// Run `paperboy help` for the resource list and
// `paperboy <resource> help` for that resource's actions.
package main

import (
	"fmt"
	"os"
)

// Version is set at build time with -ldflags "-X main.Version=...".
var Version = "dev"

func main() {
	if err := run(os.Args[1:], os.Stdout, os.Stderr); err != nil {
		if uerr, ok := err.(*usageError); ok {
			fmt.Fprintf(os.Stderr, "paperboy: %s\n", uerr.Error())
			fmt.Fprintln(os.Stderr, "Run `paperboy help` for usage.")
			os.Exit(2)
		}
		if herr, ok := err.(*httpError); ok {
			fmt.Fprintf(os.Stderr, "paperboy: request failed with status %d\n", herr.Status)
			os.Exit(1)
		}
		fmt.Fprintf(os.Stderr, "paperboy: %s\n", err.Error())
		os.Exit(1)
	}
}
