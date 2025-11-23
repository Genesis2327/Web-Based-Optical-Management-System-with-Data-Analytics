/**
 * Escape HTML to prevent XSS
 */
const escapeHtml = (text: string): string => {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
};

/**
 * Format policy content with proper HTML structure for better readability
 */
export const formatPolicyContent = (content: string): string => {
  let formatted = content.trim();
  
  // Split content into lines for processing
  const lines = formatted.split('\n');
  const processedLines: string[] = [];
  let inList = false;
  let listItems: string[] = [];
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    const nextLine = i < lines.length - 1 ? lines[i + 1].trim() : '';
    
    // Skip empty lines (they'll be handled as paragraph breaks)
    if (line === '') {
      if (inList && listItems.length > 0) {
        processedLines.push(`<ul class="list-disc mb-4 ml-6 space-y-2">${listItems.join('')}</ul>`);
        listItems = [];
        inList = false;
      }
      continue;
    }
    
    // Check for main headings (e.g., "1. INTRODUCTION")
    // Pattern: starts with number, period, space, then uppercase letters
    if (/^\d+\.\s+[A-Z][A-Z\s&]+$/.test(line) && line.length < 80 && !line.includes('.')) {
      if (inList && listItems.length > 0) {
        processedLines.push(`<ul class="list-disc mb-4 ml-6 space-y-2">${listItems.join('')}</ul>`);
        listItems = [];
        inList = false;
      }
      processedLines.push(`<h2 class="text-xl font-semibold mt-8 mb-4 text-gray-900 border-b border-gray-200 pb-2">${escapeHtml(line)}</h2>`);
      continue;
    }
    
    // Check for subheadings (e.g., "2.1 Personal Information")
    // Pattern: number.number space then text
    if (/^\d+\.\d+\s+[A-Z][A-Za-z\s&]+$/.test(line) && line.length < 80) {
      if (inList && listItems.length > 0) {
        processedLines.push(`<ul class="list-disc mb-4 ml-6 space-y-2">${listItems.join('')}</ul>`);
        listItems = [];
        inList = false;
      }
      processedLines.push(`<h3 class="text-lg font-semibold mt-6 mb-3 text-gray-800">${escapeHtml(line)}</h3>`);
      continue;
    }
    
    // Check for list items (lines starting with "-")
    if (/^-\s+/.test(line)) {
      const listItem = line.replace(/^-\s+/, '');
      listItems.push(`<li class="mb-1">${escapeHtml(listItem)}</li>`);
      inList = true;
      continue;
    }
    
    // Regular paragraph text
    if (inList && listItems.length > 0) {
      processedLines.push(`<ul class="list-disc mb-4 ml-6 space-y-2">${listItems.join('')}</ul>`);
      listItems = [];
      inList = false;
    }
    
    // Format paragraph text
    if (line.length > 0) {
      // Check if this is a standalone title (all caps, short, no numbers)
      if (line === line.toUpperCase() && line.length < 50 && !line.includes('.') && !/^\d/.test(line)) {
        processedLines.push(`<p class="text-center font-semibold text-lg mb-4 text-gray-800">${escapeHtml(line)}</p>`);
      } else {
        // Regular paragraph - escape HTML but preserve line breaks within
        const escapedLine = escapeHtml(line);
        processedLines.push(`<p class="mb-4 leading-relaxed text-gray-700">${escapedLine}</p>`);
      }
    }
  }
  
  // Close any remaining list
  if (inList && listItems.length > 0) {
    processedLines.push(`<ul class="list-disc mb-4 ml-6 space-y-2">${listItems.join('')}</ul>`);
  }
  
  // Join all processed lines
  let result = processedLines.join('\n');
  
  // Clean up consecutive empty paragraphs
  result = result.replace(/(<p[^>]*><\/p>\n?)+/g, '');
  
  // Add spacing between sections
  result = result.replace(/<\/h2>/g, '</h2>');
  result = result.replace(/<\/h3>/g, '</h3>');
  
  return result;
};

