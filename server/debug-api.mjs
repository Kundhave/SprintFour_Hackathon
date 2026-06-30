/**
 * Debug script to test the semantic detection via the running server API.
 */

const baseUrl = 'http://localhost:8787/api';

// Test document with obvious semantic PII
const testDoc = `Hello there! This document contains:
- John Smith at 123 Main Street, New York
- Maria Gonzalez who works for Acme Corporation  
- Contact info: john.smith@example.com or (415) 555-1234
- Meeting scheduled for March 15, 2024`;

console.log('=== API PIPELINE DEBUG ===\n');
console.log('Test document:', JSON.stringify(testDoc.substring(0, 100)) + '...\n');

console.log('1. TESTING /api/detect ENDPOINT');

try {
  const response = await fetch(`${baseUrl}/detect`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: testDoc }),
  });

  console.log(`Response status: ${response.status}`);
  
  if (!response.ok) {
    console.log('❌ API call failed');
    const errorText = await response.text();
    console.log('Error:', errorText);
    process.exit(1);
  }

  const result = await response.json();
  console.log('\nFull API response:');
  console.log(JSON.stringify(result, null, 2));
  
  const spans = result.spans || [];
  console.log(`\nTotal spans returned: ${spans.length}`);
  
  // Analyze by source
  const deterministicSpans = spans.filter(s => s.source === 'deterministic');
  const semanticSpans = spans.filter(s => s.source === 'semantic');
  
  console.log(`\nDeterministic spans: ${deterministicSpans.length}`);
  deterministicSpans.forEach(s => {
    console.log(`  - ${s.type}: "${s.text}" → ${s.routedTo} (${s.reason || 'no reason'})`);
  });
  
  console.log(`\nSemantic spans: ${semanticSpans.length}`);
  semanticSpans.forEach(s => {
    console.log(`  - ${s.type}: "${s.text}" → ${s.routedTo} (${s.reason || 'no reason'})`);
  });
  
  // Analyze by routing
  const autoSpans = spans.filter(s => s.routedTo === 'auto');
  const reviewSpans = spans.filter(s => s.routedTo === 'review');
  const visibleSpans = spans.filter(s => s.routedTo === 'visible');
  
  console.log(`\nRouting analysis:`);
  console.log(`  Auto: ${autoSpans.length} spans`);
  console.log(`  Review: ${reviewSpans.length} spans`);
  console.log(`  Visible: ${visibleSpans.length} spans`);
  
  if (semanticSpans.length === 0) {
    console.log('\n❌ SEMANTIC DETECTOR NOT WORKING');
    console.log('Expected entities like "John Smith", "Maria Gonzalez", "Acme Corporation", "March 15, 2024"');
  } else {
    console.log('\n✅ Semantic detector found entities');
  }
  
  if (reviewSpans.length === 0) {
    console.log('❌ NO REVIEW SPANS - Review lane will be empty');
  } else {
    console.log('✅ Review spans found - Review lane should show items');
  }
  
} catch (error) {
  console.log('❌ Network error:', error.message);
}

// Test with sample document too
console.log('\n\n2. TESTING WITH SAMPLE DOCUMENT');

try {
  const sampleResponse = await fetch(`${baseUrl}/sample`);
  const sampleData = await sampleResponse.json();
  
  console.log('Sample document length:', sampleData.text.length);
  
  const detectResponse = await fetch(`${baseUrl}/detect`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: sampleData.text }),
  });
  
  const detectResult = await detectResponse.json();
  const spans = detectResult.spans || [];
  
  const semanticSpans = spans.filter(s => s.source === 'semantic');
  const reviewSpans = spans.filter(s => s.routedTo === 'review');
  
  console.log(`Sample document semantic spans: ${semanticSpans.length}`);
  console.log(`Sample document review spans: ${reviewSpans.length}`);
  
  if (semanticSpans.length > 0) {
    console.log('Sample semantic entities found:');
    semanticSpans.slice(0, 3).forEach(s => {
      console.log(`  - ${s.type}: "${s.text}"`);
    });
  }
  
} catch (error) {
  console.log('❌ Sample test error:', error.message);
}