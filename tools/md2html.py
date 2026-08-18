import io, os, re, html, sys

def convert(md, title, subtitle):
    lines = md.split("\n")
    out, i, in_ul, in_code = [], 0, False, False
    def close_ul():
        nonlocal in_ul
        if in_ul: out.append("</ul>"); in_ul = False
    while i < len(lines):
        ln = lines[i]
        if ln.strip().startswith("```"):
            in_code = not in_code
            out.append("<pre><code>" if in_code else "</code></pre>")
            i += 1; continue
        if in_code:
            out.append(html.escape(ln)); i += 1; continue
        if ln.strip().startswith("|") and i + 1 < len(lines) and set(lines[i+1].replace("|","").strip()) <= set("-: "):
            close_ul()
            head = [c.strip() for c in ln.strip().strip("|").split("|")]
            out.append("<table><thead><tr>" + "".join("<th>%s</th>" % inline(h) for h in head) + "</tr></thead><tbody>")
            i += 2
            while i < len(lines) and lines[i].strip().startswith("|"):
                cells = [c.strip() for c in lines[i].strip().strip("|").split("|")]
                out.append("<tr>" + "".join("<td>%s</td>" % inline(c) for c in cells) + "</tr>")
                i += 1
            out.append("</tbody></table>"); continue
        if re.match(r"^#{1,4} ", ln):
            close_ul()
            level = len(ln) - len(ln.lstrip("#"))
            out.append("<h%d>%s</h%d>" % (level, inline(ln[level:].strip()), level))
        elif ln.strip() in ("---", "***"):
            close_ul(); out.append("<hr>")
        elif re.match(r"^[-*] ", ln.strip()):
            if not in_ul: out.append("<ul>"); in_ul = True
            out.append("<li>%s</li>" % inline(ln.strip()[2:]))
        elif ln.strip() == "":
            close_ul()
        else:
            # The markdown is hard-wrapped at 90 columns, so gather consecutive
            # lines into one paragraph instead of emitting one per source line.
            close_ul()
            buf = [ln.strip()]
            while (i + 1 < len(lines) and lines[i+1].strip()
                   and not re.match(r"^#{1,4} ", lines[i+1])
                   and not re.match(r"^[-*] ", lines[i+1].strip())
                   and not lines[i+1].strip().startswith("|")
                   and not lines[i+1].strip().startswith("```")
                   and lines[i+1].strip() not in ("---", "***")):
                i += 1
                buf.append(lines[i].strip())
            out.append("<p>%s</p>" % inline(" ".join(buf)))
        i += 1
    close_ul()
    body = "\n".join(out)
    return TEMPLATE % (html.escape(title), html.escape(title), html.escape(subtitle), body)

def inline(t):
    t = html.escape(t)
    t = re.sub(r"`([^`]+)`", r"<code>\1</code>", t)
    t = re.sub(r"\*\*([^*]+)\*\*", r"<strong>\1</strong>", t)
    t = re.sub(r"\[([^\]]+)\]\(([^)]+)\)", r'<a href="\2">\1</a>', t)
    return t

TEMPLATE = """<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>%s &mdash; Site Label</title>
<style>
  :root { color-scheme: light dark; }
  body { margin:0; padding:0 20px 80px; background:#fbfbfd; color:#1b1b1f;
         font:16px/1.65 "Segoe UI", system-ui, -apple-system, sans-serif; }
  .wrap { max-width: 760px; margin: 0 auto; }
  header { padding: 44px 0 8px; border-bottom: 1px solid #e4e4ea; margin-bottom: 28px; }
  h1 { font-size: 30px; margin: 0 0 6px; letter-spacing: -.01em; }
  .sub { color:#63636c; margin:0; }
  h2 { font-size:20px; margin:34px 0 10px; }
  h3 { font-size:16px; margin:24px 0 8px; }
  p, li { color:#2a2a31; }
  ul { padding-left: 22px; }
  li { margin: 5px 0; }
  code { background:#f0f0f4; padding:1px 5px; border-radius:4px; font-size:.9em;
         font-family: Consolas, "Cascadia Mono", monospace; }
  pre { background:#f0f0f4; padding:14px 16px; border-radius:8px; overflow-x:auto; }
  pre code { background:none; padding:0; }
  table { border-collapse: collapse; width:100%%; margin: 14px 0; font-size:15px; }
  th, td { border:1px solid #e4e4ea; padding:8px 10px; text-align:left; vertical-align:top; }
  th { background:#f4f4f8; }
  hr { border:0; border-top:1px solid #e4e4ea; margin:28px 0; }
  a { color:#1565c0; }
  footer { margin-top:50px; padding-top:18px; border-top:1px solid #e4e4ea;
           color:#77777f; font-size:14px; }
  @media (prefers-color-scheme: dark) {
    body { background:#161619; color:#ececf1; }
    header, hr, th, td, footer { border-color:#33333a; }
    .sub, footer { color:#a0a0a8; }
    p, li { color:#dcdce2; }
    code, pre, th { background:#232329; }
    a { color:#6aa9f5; }
  }
</style>
</head>
<body>
<div class="wrap">
<header>
  <h1>%s</h1>
  <p class="sub">%s</p>
</header>
%s
<footer>Site Label &mdash; a Microsoft Edge extension. <a href="./">All documents</a></footer>
</div>
</body>
</html>
"""

if __name__ == "__main__":
    src, dst, title, sub = sys.argv[1:5]
    md = io.open(src, encoding="utf-8").read()
    # drop the leading H1, the template supplies it
    md = re.sub(r"^# [^\n]*\n", "", md, count=1)
    io.open(dst, "w", encoding="utf-8", newline="\n").write(convert(md, title, sub))
    print("wrote", dst)
