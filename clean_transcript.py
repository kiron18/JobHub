import sys
from bs4 import BeautifulSoup

def clean_transcript(file_path):
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
    except Exception as e:
        print(f"Error reading file: {e}")
        return

    # Parse the HTML content
    soup = BeautifulSoup(content, 'html.parser')
    
    # Find all paragraph blocks by their ID prefix
    paragraphs = soup.find_all('div', id=lambda x: x and x.startswith('transcript-paragraph-'))
    
    if not paragraphs:
        print("No transcript paragraphs found. Make sure this is the correct HTML file.")
        return

    for p in paragraphs:
        # Extract speaker name
        speaker_span = p.find('span', class_='name')
        speaker = speaker_span.get_text(strip=True) if speaker_span else "Unknown"
        
        # Extract sentences
        sentence_spans = p.find_all('span', class_=lambda x: x and 'speakerStyles__SentenceWrapper' in x)
        text = " ".join([s.get_text(strip=True) for s in sentence_spans])
        
        # Clean up any extra spaces
        text = " ".join(text.split())
        
        if text:
            print(f"{speaker}: {text}\n")

if __name__ == '__main__':
    if len(sys.argv) < 2:
        print("Usage: python clean_transcript.py <path_to_file>")
        sys.exit(1)
    
    clean_transcript(sys.argv[1])
