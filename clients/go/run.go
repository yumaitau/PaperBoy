package main

import (
	"fmt"
	"io"
	"strings"
)

func run(args []string, stdout, stderr io.Writer) error {
	// Fast paths that need no configuration.
	if len(args) == 0 {
		printRootHelp(stdout)
		return &usageError{msg: "a resource is required"}
	}
	if args[0] == "version" || args[0] == "--version" || args[0] == "-V" {
		fmt.Fprintln(stdout, "paperboy "+Version)
		return nil
	}
	for _, arg := range args {
		if arg == "help" || arg == "--help" || arg == "-h" {
			printHelp(stdout, args)
			return nil
		}
	}

	cfg, inv, err := ParseArgs(args)
	if err != nil {
		if uerr, ok := err.(*usageError); ok && uerr.msg == "help requested" {
			printHelp(stdout, args)
			return nil
		}
		if _, ok := err.(*usageError); ok {
			printHelp(stdout, args)
		}
		return err
	}
	if inv.Resource == nil {
		fmt.Fprintln(stdout, "paperboy "+Version)
		return nil
	}

	payload, _, err := inv.Do(cfg)
	if herr, ok := err.(*httpError); ok {
		if len(herr.Body) > 0 {
			_ = PrintJSON(stdout, herr.Body, cfg.Compact)
		}
		return herr
	}
	if err != nil {
		return err
	}
	return PrintJSON(stdout, payload, cfg.Compact)
}

func printRootHelp(out io.Writer) {
	fmt.Fprintln(out, "paperboy — call the PaperBoy HTTP API with a bearer key.")
	fmt.Fprintln(out, "")
	fmt.Fprintln(out, "Usage:")
	fmt.Fprintln(out, "  paperboy <resource> <action> [id...] [--set key=value] [--query k=v]")
	fmt.Fprintln(out, "      [--json '{\"raw\": 1}'] [--body-file data.json] [--file data.csv]")
	fmt.Fprintln(out, "")
	fmt.Fprintln(out, "Global flags (PAPERBOY_API_KEY and PAPERBOY_URL are read from the environment):")
	fmt.Fprintln(out, "  -e, --endpoint URL   API base URL (default http://localhost:3000)")
	fmt.Fprintln(out, "  -k, --api-key KEY    Bearer key (required)")
	fmt.Fprintln(out, "  --timeout SECONDS    Request timeout (default 30)")
	fmt.Fprintln(out, "  --compact            Print compact JSON instead of indented")
	fmt.Fprintln(out, "  --version            Print the client version")
	fmt.Fprintln(out, "")
	fmt.Fprintln(out, "Resources:")
	max := 0
	for _, r := range resources {
		if len(r.Name) > max {
			max = len(r.Name)
		}
	}
	for _, r := range resources {
		fmt.Fprintf(out, "  %-*s  %s\n", max, r.Name, r.Desc)
	}
	fmt.Fprintln(out, "")
	fmt.Fprintln(out, "Run `paperboy <resource> help` for that resource's actions.")
}

func printHelp(out io.Writer, args []string) {
	// `paperboy <resource> help` prints that resource's actions.
	for _, arg := range args {
		if arg == "help" || arg == "--help" || arg == "-h" {
			for _, a := range args {
				if a == "help" || a == "--help" || a == "-h" {
					continue
				}
				if strings.HasPrefix(a, "-") {
					continue
				}
				for i := range resources {
					if resources[i].Name == a {
						printResourceHelp(out, &resources[i])
						return
					}
				}
			}
			printRootHelp(out)
			return
		}
	}
	printRootHelp(out)
}

func printResourceHelp(out io.Writer, resource *Resource) {
	fmt.Fprintf(out, "paperboy %s — %s.\n", resource.Name, resource.Desc)
	fmt.Fprintln(out, "")
	fmt.Fprintln(out, "Actions:")
	for _, action := range resource.Actions {
		usage := "paperboy " + resource.Name + " " + action.Name
		for _, slot := range action.Slots {
			usage += " <" + slot + ">"
		}
		var hints []string
		if action.HasBody {
			hints = append(hints, "--set/--json/--body-file")
		}
		if action.HasQuery {
			hints = append(hints, "--query")
		}
		if action.Upload != "" {
			hints = append(hints, "--file")
		}
		if len(hints) > 0 {
			usage += " [" + strings.Join(hints, " ") + "]"
		}
		fmt.Fprintf(out, "  %s\n", usage)
		fmt.Fprintf(out, "      %s %s — %s\n", action.Method, action.Path, action.Desc)
	}
}
