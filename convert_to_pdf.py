from markdown_pdf import MarkdownPdf
from markdown_pdf import Section

# Create PDF converter
pdf = MarkdownPdf(toc_level=2)

# Read markdown content
with open('Y-Axis_Case_File.md', 'r', encoding='utf-8') as f:
    content = f.read()

# Add content as a section
pdf.add_section(Section(content, paper_size='A4'))

# Save PDF
pdf.save('Y-Axis_Case_File.pdf')

print('PDF created successfully: Y-Axis_Case_File.pdf')
