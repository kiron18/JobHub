"""Render Anurag's reworked resume as a clean, ATS-friendly, polished PDF."""
from markdown_pdf import MarkdownPdf, Section

CSS = """
body {
    font-family: Helvetica, Arial, sans-serif;
    color: #2b2b2b;
    font-size: 10.5pt;
    line-height: 1.38;
}
h1 {
    font-family: Georgia, 'Times New Roman', serif;
    color: #1b2a3a;
    font-size: 26pt;
    letter-spacing: 1px;
    margin-bottom: 0;
    padding-bottom: 0;
}
h4 {
    color: #2c5f6f;
    font-size: 11.5pt;
    font-weight: bold;
    margin-top: 2pt;
    margin-bottom: 2pt;
}
h2 {
    color: #1b2a3a;
    font-size: 11pt;
    text-transform: uppercase;
    letter-spacing: 1.5px;
    border-bottom: 1.5px solid #2c5f6f;
    padding-bottom: 2pt;
    margin-top: 13pt;
    margin-bottom: 6pt;
}
h3 {
    color: #1b2a3a;
    font-size: 11.5pt;
    margin-top: 10pt;
    margin-bottom: 1pt;
}
strong { color: #1b2a3a; }
em { color: #5a6470; }
ul { margin-top: 3pt; margin-bottom: 3pt; }
li { margin-bottom: 2pt; }
hr {
    border: none;
    border-top: 1px solid #c9d2da;
    margin: 7pt 0;
}
p { margin: 3pt 0; }
a { color: #2c5f6f; text-decoration: none; }
"""

pdf = MarkdownPdf(toc_level=0)
with open("Anurag_Sharma_Resume.md", "r", encoding="utf-8") as f:
    content = f.read()
pdf.add_section(Section(content, paper_size="A4", borders=(38, 32, -38, -32)), user_css=CSS)
pdf.meta["title"] = "Anurag Sharma Resume"
pdf.meta["author"] = "Anurag Sharma"
pdf.save("Anurag_Sharma_Resume.pdf")
print("Created Anurag_Sharma_Resume.pdf")
