export async function extractText(file: File): Promise<string> {
  const buf = Buffer.from(await file.arrayBuffer());
  const name = file.name.toLowerCase();
  if (name.endsWith('.pdf')) {
    const { extractText: pdfText, getDocumentProxy } = await import('unpdf');
    const doc = await getDocumentProxy(new Uint8Array(buf));
    const { text } = await pdfText(doc, { mergePages: false });
    return Array.isArray(text) ? text.join('\n') : text;
  }
  if (name.endsWith('.docx')) {
    const mammoth = await import('mammoth');
    return (await mammoth.extractRawText({ buffer: buf })).value;
  }
  if (name.endsWith('.txt') || name.endsWith('.md')) return buf.toString('utf8');
  throw new Error('Unsupported file type. Use PDF, DOCX or TXT.');
}
