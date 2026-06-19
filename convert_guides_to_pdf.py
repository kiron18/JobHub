"""Convert Anurag's guide markdown files into clean, on-brand PDFs."""
from markdown_pdf import MarkdownPdf, Section

CSS = """
body {
    font-family: Helvetica, Arial, sans-serif;
    color: #1f1c17;
    font-size: 11pt;
    line-height: 1.6;
}
h1 {
    font-family: Georgia, 'Times New Roman', serif;
    color: #1a1712;
    font-size: 24pt;
    margin-bottom: 2pt;
    border-bottom: 2px solid #a87b2d;
    padding-bottom: 6pt;
}
h2 {
    font-family: Georgia, 'Times New Roman', serif;
    color: #a87b2d;
    font-size: 16pt;
    margin-top: 22pt;
    margin-bottom: 4pt;
}
h3 {
    font-family: Georgia, 'Times New Roman', serif;
    color: #5a4d36;
    font-size: 12pt;
    font-weight: normal;
    font-style: italic;
    margin-top: 2pt;
}
strong { color: #1a1712; }
blockquote {
    border-left: 3px solid #a87b2d;
    margin-left: 0;
    padding-left: 14pt;
    color: #4a443a;
    font-style: italic;
}
ul, ol { margin-top: 4pt; }
li { margin-bottom: 4pt; }
hr {
    border: none;
    border-top: 1px solid #d8d0c0;
    margin: 18pt 0;
}
em { color: #6b6354; }
p { margin: 6pt 0; }
"""

FILES = [
    ("Anurag_Target_Company_Framework.md", "Anurag_Target_Company_Framework.pdf", "Target Company Framework"),
    ("Anurag_LinkedIn_Playbook.md", "Anurag_LinkedIn_Playbook.pdf", "LinkedIn Playbook"),
]

for src, out, title in FILES:
    pdf = MarkdownPdf(toc_level=0)
    with open(src, "r", encoding="utf-8") as f:
        content = f.read()
    pdf.add_section(Section(content, paper_size="A4"), user_css=CSS)
    pdf.meta["title"] = title
    pdf.meta["author"] = "Kiron"
    pdf.save(out)
    print(f"Created {out}")
