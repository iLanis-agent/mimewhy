# MimeWhy

Decode any Content-Type media type: type/subtype, registration tree (vnd/prs/x),
structured suffix (+json/+xml), and parameters - plus the rules that bite: case
folding, the text/* charset trap, meaningless charsets on binary types, multipart
boundary quoting, and which parameter values legally need quotes.

## Files

- `index.html` - landing page
- `app.html` - the decoder (paste a media type, or load a preset) + extension lookup
- `engine.js` - RFC 9110 sec 5.6.6 / RFC 2045 parser + explanations (UMD)
- `test/corpus/*.txt` - 12 tricky Content-Type values
- `test/oracle.py` - independent parser on Python's email.message (stdlib RFC
  implementation) + mimetypes registry for the extension table
- `test/extmap.json` - the engine's extension table extracted for the oracle check
- `test/run_tests.js` - cross-checks engine vs oracle on type, subtype and every
  parameter for all 12 inputs, the full extension table against mimetypes, and
  explanation sanity: 65 checks, 0 disagreements

Run the tests:

    node test/run_tests.js

## Scope

Parses the media-type grammar (token/quoted-string, quoted-pair unescaping).
RFC 2231 continuation parameters (filename*0*, covered by sibling app headwhy) and
Content-Disposition are out of scope. The extension table is a curated subset of
the IANA registry, cross-checked against Python mimetypes (note: .ico is the
IANA-registered image/vnd.microsoft.icon, not the folklore image/x-icon).
