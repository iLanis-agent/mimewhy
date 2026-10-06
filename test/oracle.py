"""Independent media-type parser: Python email.message + mimetypes (stdlib)."""
import json, sys, os, email.message, mimetypes

def parse(s):
    msg = email.message.Message()
    msg['Content-Type'] = s.strip()
    ct = msg.get_content_type()  # lowercases, default text/plain on garbage
    maintype, _, subtype = ct.partition('/')
    params = msg.get_params([]) or []
    out_params = []
    for name, val in params:
        if isinstance(val, tuple):
            val = val[2]
        if '/' in name:  # get_params includes the media type itself first
            continue
        out_params.append([name.lower(), val])
    return {"type": maintype, "subtype": subtype, "params": out_params}

corpus = sys.argv[1]
result = {}
for fn in sorted(os.listdir(corpus)):
    if fn.endswith('.txt'):
        result[fn] = parse(open(os.path.join(corpus, fn)).read())

# extension map cross-check
exts = {}
for ext, expected in json.load(open(os.path.join(os.path.dirname(corpus), 'extmap.json'))).items():
    g, _ = mimetypes.guess_type('file.' + ext)
    exts[ext] = g
result['_ext'] = exts
print(json.dumps(result))
