from pathlib import Path

p = Path('scripts/_apply_server_documents_state.py')
text = p.read_text(encoding='utf-8')
text = text.replace('businessOperational BusinessOperationalState?', 'businessOperationalState BusinessOperationalState?')
p.write_text(text, encoding='utf-8')
