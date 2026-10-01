export async function extractText(file: File): Promise<string> {
  const buf = Buffer.from(await file.arrayBuffer());
  const name = file.name.toLowerCase();
  if (name.endsWith('.pdf')) {
    const pdf = (await import('pdf-parse/lib/pdf-parse.js')).default;
    return (await pdf(buf)).text;
  }
  if (name.endsWith('.docx')) {
    const mammoth = await import('mammoth');
    return (await mammoth.extractRawText({ buffer: buf })).value;
  }
  if (name.endsWith('.txt') || name.endsWith('.md')) return buf.toString('utf8');
  throw new Error('Unsupported file type. Use PDF, DOCX or TXT.');
}
