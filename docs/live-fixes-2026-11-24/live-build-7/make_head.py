# make_head.py IN OUT: rewrite the home page's head so its title, description, link preview and structured data all
# say the same thing about the company (Johnson's wording, 2026-11-24). Works on index.html as written or as built;
# the file's line endings and everything else in it are kept. Every replacement must match exactly once.
import json, re, sys
TITLE = "Solaria Capital — Student-run fund and university spinouts"
DESCRIPTION = ("Solaria Capital is a private company with a student-funded fund run by students. "
               "We build spinout companies from university research and patents, like UC San Diego's.")
src, out = sys.argv[1], sys.argv[2]
text = open(src, encoding='utf-8', newline='').read()
nl = '\r\n' if '\r\n' in text else '\n'
def swap(pattern, repl, flags=re.S):
    global text
    found = re.findall(pattern, text, flags)
    if len(found) != 1: sys.exit(f'{src}: expected one match of {pattern!r}, found {len(found)}')
    text = re.sub(pattern, lambda m: repl(m) if callable(repl) else repl, text, count=1, flags=flags)
content = lambda value: (lambda m: m.group(1) + value + m.group(2))
swap(r'<title>[^<]*</title>', f'<title>{TITLE}</title>')
swap(r'(<meta\s+name="description"\s+content=")[^"]*("\s*/>)', content(DESCRIPTION))
swap(r'(<meta\s+property="og:title"\s+content=")[^"]*("\s*/>)', content(TITLE))
swap(r'(<meta\s+property="og:description"\s+content=")[^"]*("\s*/>)', content(DESCRIPTION))
swap(r'(<meta\s+name="twitter:card"\s+content=")[^"]*("\s*/>)', content('summary'))      # the picture is the square logo
swap(r'(<meta\s+name="twitter:title"\s+content=")[^"]*("\s*/>)', content(TITLE))
swap(r'(<meta\s+name="twitter:description"\s+content=")[^"]*("\s*/>)', content(DESCRIPTION))
old = re.search(r'<script type="application/ld\+json">(.*?)</script>', text, re.S)
was = json.loads(old.group(1))
company = {
    "@type": "Organization", "@id": "https://solariavc.com/#company", "name": "Solaria Capital", "legalName": "Solaria Capital, LLC",
    "alternateName": was.get("alternateName", ["Solaria Capital, LLC", "Solaria"]), "url": "https://solariavc.com/",
    "logo": "https://solariavc.com/logo.png", "image": "https://solariavc.com/logo.png", "description": DESCRIPTION,
    "address": was["address"], "foundingDate": was["foundingDate"], "founders": was["founders"],
    "sameAs": ["https://linktr.ee/solariaventure"],
}
site = {"@type": "WebSite", "@id": "https://solariavc.com/#site", "url": "https://solariavc.com/", "name": "Solaria Capital",
        "publisher": {"@id": "https://solariavc.com/#company"}}
block = json.dumps({"@context": "https://schema.org", "@graph": [company, site]}, indent=2, ensure_ascii=False)
block = nl.join('      ' + line for line in block.split('\n'))
swap(r'<script type="application/ld\+json">.*?</script>', '<script type="application/ld+json">' + nl + block + nl + '    </script>')
open(out, 'w', encoding='utf-8', newline='').write(text)
print('wrote', out, '| title', len(TITLE), 'chars | description', len(DESCRIPTION), 'chars | line ending', repr(nl))
