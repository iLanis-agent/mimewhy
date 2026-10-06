/* MimeWhy engine: parse a Content-Type media type per RFC 9110 sec 5.6.6 /
   RFC 2045 and explain what every part does. Pure functions. */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.MimeWhy = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var TOKEN = /^[!#$%&'*+\-.^_`|~0-9A-Za-z]+$/;

  // Parse: { type, subtype, tree, suffix, params: [[name, value]], errors: [] }
  // type/subtype/name are lowercased by the parser (spec: case-insensitive);
  // parameter VALUES are preserved exactly.
  function parse(input) {
    var errors = [];
    var s = String(input).trim();
    var semi = splitParams(s);
    var head = semi[0].trim();
    var slash = head.indexOf('/');
    if (slash === -1) {
      errors.push('no "/" found - a media type is type/subtype');
      return { type: null, subtype: null, tree: null, suffix: null, params: [], errors: errors };
    }
    var type = head.slice(0, slash).trim().toLowerCase();
    var subtype = head.slice(slash + 1).trim().toLowerCase();
    if (!TOKEN.test(type)) errors.push('type "' + type + '" is not a valid token');
    if (!TOKEN.test(subtype)) errors.push('subtype "' + subtype + '" is not a valid token');
    var tree = null, suffix = null;
    var m = /^(vnd|prs|x)\.(.+)$/.exec(subtype);
    if (m) tree = m[1];
    var sm = /\+([a-z0-9.+-]+)$/.exec(subtype);
    if (sm) suffix = sm[1];
    var params = [];
    for (var i = 1; i < semi.length; i++) {
      var p = semi[i];
      var eq = p.indexOf('=');
      if (eq === -1) { errors.push('parameter "' + p.trim() + '" has no = sign'); continue; }
      var name = p.slice(0, eq).trim().toLowerCase();
      var val = p.slice(eq + 1).trim();
      if (val.length >= 2 && val[0] === '"' && val[val.length - 1] === '"') {
        val = val.slice(1, -1).replace(/\\(.)/g, '$1');
      } else if (val[0] === '"') {
        errors.push('parameter ' + name + ' has an unterminated quoted string');
        val = val.slice(1);
      }
      if (!TOKEN.test(name)) errors.push('parameter name "' + name + '" is not a valid token');
      params.push([name, val]);
    }
    return { type: type, subtype: subtype, tree: tree, suffix: suffix, params: params, errors: errors };
  }

  // Split on ';' but not inside quoted strings.
  function splitParams(s) {
    var parts = [], cur = '', q = false, esc = false;
    for (var i = 0; i < s.length; i++) {
      var c = s[i];
      if (esc) { cur += c; esc = false; continue; }
      if (c === '\\' && q) { cur += c; esc = true; continue; }
      if (c === '"') { q = !q; cur += c; continue; }
      if (c === ';' && !q) { parts.push(cur); cur = ''; continue; }
      cur += c;
    }
    parts.push(cur);
    return parts;
  }

  var TYPES = {
    text: 'human-readable text; line breaks are CRLF on the wire, and charset actually matters here',
    image: 'an image; never send a charset - bytes, not characters',
    audio: 'sound',
    video: 'video',
    font: 'a font file (RFC 8081); woff2 lives here, not in application/',
    application: 'binary data or a structured format for applications; the catch-all top level',
    multipart: 'several body parts in one message; the boundary parameter is mandatory',
    message: 'an encapsulated message, e.g. message/rfc822 for a forwarded email',
    model: 'a 3D model (rare outside CAD/3D)'
  };
  var TREES = {
    vnd: 'vendor tree: a type owned by a company or product (vnd.api+json, vnd.ms-excel). Registered, but not an IETF standard.',
    prs: 'personal tree: someone\'s unregistered-experimental type, published informally',
    x: 'unregistered x- type: the old convention for "not standardized"; RFC 6838 deprecated the x- prefix but it is everywhere'
  };
  var SUFFIXES = {
    json: '+json suffix (RFC 6839): the body is JSON - processors may treat it as JSON even without knowing the specific type',
    xml: '+xml suffix: the body is XML (RFC 7303)',
    zip: '+zip suffix: the body is a zip archive of something specific',
    cbor: '+cbor suffix: CBOR binary JSON (RFC 8949)',
    'ber': '+ber suffix: ASN.1 BER encoding',
    der: '+der suffix: ASN.1 DER encoding',
    wbxml: '+wbxml suffix: WAP binary XML',
    gzip: '+gzip suffix: the body is gzipped content of the base type'
  };

  function explain(p, raw) {
    var notes = [];
    function push(sev, text) { notes.push({ sev: sev, text: text }); }
    if (p.errors.length) {
      for (var i = 0; i < p.errors.length; i++) push('warn', 'Parse issue: ' + p.errors[i] + '.');
    }
    if (!p.type) return notes;

    if (/[A-Z]/.test(raw.split(';')[0])) {
      push('info', 'Case folding: type and subtype are case-insensitive - "Text/HTML" IS "text/html". Parameter NAMES are too; parameter VALUES are case-sensitive (except charset by convention).');
    }
    if (TYPES[p.type]) push('info', 'Top-level "' + p.type + '": ' + TYPES[p.type] + '.');
    if (p.tree && TREES[p.tree]) push('info', 'Tree "' + p.tree + '.": ' + TREES[p.tree]);
    if (p.suffix && SUFFIXES[p.suffix]) push('ok', 'Structured suffix: ' + SUFFIXES[p.suffix] + '.');

    var params = {};
    for (var i = 0; i < p.params.length; i++) params[p.params[i][0]] = p.params[i][1];

    if (p.type === 'text' && !params.charset) {
      push('warn', 'No charset on a text/* type: receivers must GUESS the encoding. Old HTTP said ISO-8859-1; modern stacks assume UTF-8; mojibake is born here. Always send "text/html; charset=utf-8".');
    }
    if (params.charset && p.type !== 'text' && !p.suffix !== true && p.type !== 'application') {
      // only text and some application types use charset meaningfully
    }
    if (params.charset && (p.type === 'image' || p.type === 'audio' || p.type === 'video' || p.type === 'font')) {
      push('warn', 'charset on ' + p.type + '/* is meaningless - these are bytes, not text. Receivers ignore it.');
    }
    if (params.charset && p.type === 'application' && p.suffix === 'json') {
      push('info', 'charset on application/' + p.subtype + ': JSON is defined as Unicode (UTF-8/16/32 detection is built into the format), so a charset is unnecessary - and "application/json; charset=iso-8859-1" breaks naive parsers.');
    }
    if (p.type === 'multipart') {
      if (params.boundary) {
        push('ok', 'boundary="' + params.boundary + '": the delimiter that splits the parts. It must be quoted if it contains spaces or specials, must not appear in the content, and the closing delimiter gets a trailing "--". Most multipart bugs are boundary quoting bugs.');
      } else {
        push('warn', 'multipart with NO boundary parameter: the message is unparsable - the boundary is mandatory (RFC 2046 sec 5.1.1).');
      }
    }
    if (p.type === 'message' && p.subtype === 'rfc822') {
      push('info', 'message/rfc822: a whole email message as the body - what "forward as attachment" produces.');
    }
    if (p.type === 'application' && p.subtype === 'octet-stream') {
      push('info', 'application/octet-stream: "bytes, unknown". Browsers download rather than display; APIs treat it as "figure it out yourself". It is the honest fallback when no type fits.');
    }
    for (var j = 0; j < p.params.length; j++) {
      var v = p.params[j][1];
      if (v.indexOf(' ') !== -1 || v.indexOf(';') !== -1) {
        push('info', 'Parameter "' + p.params[j][0] + '" needed quotes: its value contains a space or semicolon - unquoted, it would split into garbage parameters.');
        break;
      }
    }
    if (/;[^;]*=[^"]*[<>()[\]@,:\\]/.test(raw)) {
      push('warn', 'A parameter value contains specials (< > ( ) [ ] @ , : \\) outside quotes: per RFC 2045 those REQUIRE a quoted-string, or strict parsers will reject the header.');
    }
    return notes;
  }

  // Tiny extension map (subset of the IANA registry); oracle checks vs Python mimetypes.
  var EXT = {
    'html': 'text/html', 'htm': 'text/html', 'txt': 'text/plain', 'css': 'text/css',
    'csv': 'text/csv', 'js': 'text/javascript', 'mjs': 'text/javascript',
    'json': 'application/json', 'xml': 'application/xml', 'pdf': 'application/pdf',
    'zip': 'application/zip', 'gz': 'application/gzip', 'wasm': 'application/wasm',
    'png': 'image/png', 'jpg': 'image/jpeg', 'jpeg': 'image/jpeg', 'gif': 'image/gif',
    'svg': 'image/svg+xml', 'webp': 'image/webp', 'ico': 'image/vnd.microsoft.icon',
    'mp3': 'audio/mpeg', 'mp4': 'video/mp4', 'woff2': 'font/woff2', 'woff': 'font/woff',
    'ttf': 'font/ttf', 'otf': 'font/otf', 'md': 'text/markdown', 'yaml': 'application/yaml',
    'yml': 'application/yaml', 'webm': 'video/webm', 'avif': 'image/avif'
  };

  return { parse: parse, explain: explain, EXT: EXT, TOKEN: TOKEN };
});
