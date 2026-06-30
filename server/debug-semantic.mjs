/**
 * Debug script to trace the semantic detection pipeline step by step.
 * This will show exactly where the pipeline breaks.
 */

import { sampleDocument } from '../fixtures/sample-document.ts';
import { deterministicDetector, semanticDetector, OLLAMA_MODEL, OLLAMA_URL } from './src/detection/index.ts';
import { reconcile, route, group, locateSpans } from './src/domain/index.ts';

const text = `Hello there! This document contains:
- John Smith at 123 Main Street, New York
- Maria Gonzalez who works for Acme Corporation
- Contact info: john.smith@example.com or (415) 555-1234
- Meeting scheduled for March 15, 2024`;

console.log('=== SEMANTIC DETECTION PIPELINE DEBUG ===\n');
console.log('Document text:', JSON.stringify(text.substring(0, 100)) + '...\n');

console.log('1. OLLAMA CONNECTION CHECK');
console.log(`   URL: ${OLLAMA_URL}`);
console.log(`   Model: ${OLLAMA_MODEL}`);

try {
  const tagsRes = await fetch(`${OLLAMA_URL}/api/tags`);
  const tags = await tagsRes.json();
  console.log('   Available models:', tags.models?.map(m => m.name).join(', ') || 'None');
  
  const hasModel = tags.models?.some(m => m.name === OLLAMA_MODEL);
  console.log(`   ${hasModel ? '✅' : '❌'} Target model "${OLLAMA_MODEL}" ${hasModel ? 'available' : 'NOT AVAILABLE'}\n`);
  
  if (!hasModel) {
    console.log('❌ PIPELINE BROKEN: Model not available');
    process.exit(1);
  }
} catch (error) {
  console.log(`   ❌ Ollama connection failed: ${error.message}\n`);
  console.log('❌ PIPELINE BROKEN: Cannot reach Ollama');
  process.exit(1);
}

console.log('2. DETERMINISTIC DETECTOR');
const deterministicSpans = await deterministicDetector.detect(text);
console.log(`   Found ${deterministicSpans.length} structured spans:`);
deterministicSpans.forEach(s => {
  console.log(`   - ${s.type}: "${s.text}" [${s.start}-${s.end}] conf=${s.confidence}`);
});
console.log();

console.log('3. SEMANTIC DETECTOR');
console.log('   Calling semantic detector...');
const semanticSpans = await semanticDetector.detect(text);
console.log(`   ${semanticSpans.length > 0 ? '✅' : '❌'} Found ${semanticSpans.length} semantic spans:`);
semanticSpans.forEach(s => {
  console.log(`   - ${s.type}: "${s.text}" [${s.start}-${s.end}] conf=${s.confidence} source=${s.source}`);
});

if (semanticSpans.length === 0) {
  console.log('   ❌ PIPELINE BROKEN: Semantic detector returned no results');
  
  // Let's test the raw Ollama call
  console.log('\n   DEBUGGING RAW OLLAMA CALL:');
  try {
    const prompt = [
      'You extract ONLY semantic PII from a document for a redaction tool.',
      'Return STRICT JSON of the form:',
      '{"items":[{"text":"<verbatim substring>","type":"<TYPE>","confidence":<number 0..1>}]}',
      'Allowed types: NAME (a person), ORG (an organization), ADDRESS (a mailing/physical address), DATE.',
      'Do NOT include phone numbers, emails, or SSNs — those are handled by a separate detector.',
      'Each "text" MUST be copied verbatim from the document. Do NOT include character offsets.',
      'If there is no semantic PII, return {"items":[]}.',
      '',
      'DOCUMENT:',
      text,
    ].join('\n');
    
    console.log('   Prompt sent to Ollama:');
    console.log('   ' + prompt.split('\n').join('\n   '));
    console.log();
    
    const res = await fetch(`${OLLAMA_URL}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        prompt,
        stream: false,
        format: 'json',
        options: { temperature: 0 },
      }),
    });
    
    console.log(`   Response status: ${res.status}`);
    
    if (!res.ok) {
      console.log(`   ❌ HTTP error: ${res.status}`);
      const errorText = await res.text();
      console.log(`   Error body: ${errorText}`);
    } else {
      const body = await res.json();
      console.log('   Raw response:', JSON.stringify(body, null, 2));
      console.log(`   Response field: ${JSON.stringify(body.response)}`);
    }
    
  } catch (error) {
    console.log(`   ❌ Ollama call failed: ${error.message}`);
  }
  
  process.exit(1);
}
console.log();

console.log('4. RECONCILIATION');
const reconciled = reconcile(deterministicSpans, semanticSpans);
console.log(`   ${reconciled.length > 0 ? '✅' : '❌'} After reconciliation: ${reconciled.length} spans`);
reconciled.forEach(s => {
  console.log(`   - ${s.type}: "${s.text}" [${s.start}-${s.end}] source=${s.source} reason="${s.reason}"`);
});
console.log();

console.log('5. GROUPING');
const grouped = group(reconciled);
console.log(`   ✅ After grouping: ${grouped.length} spans (groupKey added)`);
console.log();

console.log('6. ROUTING');
const routed = route(grouped);
console.log(`   ✅ After routing: ${routed.length} spans`);

const autoSpans = routed.filter(s => s.routedTo === 'auto');
const reviewSpans = routed.filter(s => s.routedTo === 'review');
const visibleSpans = routed.filter(s => s.routedTo === 'visible');

console.log(`   Auto-redacted: ${autoSpans.length}`);
autoSpans.forEach(s => {
  console.log(`   - ${s.type}: "${s.text}" → ${s.status} (${s.reason})`);
});

console.log(`   Review lane: ${reviewSpans.length}`);
reviewSpans.forEach(s => {
  console.log(`   - ${s.type}: "${s.text}" → ${s.status} (${s.reason})`);
});

console.log(`   Left visible: ${visibleSpans.length}`);
visibleSpans.forEach(s => {
  console.log(`   - ${s.type}: "${s.text}" → ${s.status} (${s.reason})`);
});

if (reviewSpans.length === 0) {
  console.log('\n❌ PIPELINE ISSUE: No spans routed to review lane');
  console.log('   Expected: NAME, ORG, ADDRESS, DATE should go to review');
} else {
  console.log('\n✅ PIPELINE WORKING: Spans correctly routed to review lane');
}