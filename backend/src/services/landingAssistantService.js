const { getApprovedKnowledge } = require('./landingAssistantKnowledge');

const ACTIONS = {
  pricing: { label: 'Compare plans', target: 'pricing' },
  features: { label: 'Explore features', target: 'features' },
  register: { label: 'Start registration', target: 'register' },
  'custom-solution': { label: 'Build a custom plan', target: 'custom-solution' },
  contact: { label: 'Contact Audito', target: 'contact' },
};

const STOP_WORDS = new Set(['about', 'after', 'again', 'also', 'and', 'are', 'audito', 'can', 'does', 'for', 'from', 'have', 'how', 'into', 'is', 'its', 'like', 'need', 'our', 'please', 'the', 'this', 'that', 'their', 'there', 'they', 'what', 'when', 'which', 'with', 'you', 'your']);

const words = (value) => String(value || '').toLowerCase().match(/[a-z0-9-]{3,}/g)?.filter((word) => !STOP_WORDS.has(word)) || [];

const findActions = (message) => {
  const text = message.toLowerCase();
  const actions = [];
  if (/price|plan|basic|pro|elite|trial|billing|cost|renew/.test(text)) actions.push('pricing', 'register');
  if (/custom|enterprise|tailor|customer|buying office|supplier|audit firm/.test(text)) actions.push('custom-solution', 'contact');
  if (/contact|sales|demo|support|call|email/.test(text)) actions.push('contact');
  if (/feature|audit|checklist|evidence|report|corrective|cap|auditor|department|structure|supplier|partner/.test(text)) actions.push('features');
  return [...new Set(actions)].slice(0, 2);
};

const selectKnowledge = (knowledge, message) => {
  const queryWords = words(message);
  const scored = knowledge.map((item, index) => {
    const topic = item.topic.toLowerCase();
    const content = item.content.toLowerCase();
    const score = queryWords.reduce((total, word) => total + (topic.includes(word) ? 3 : 0) + (content.includes(word) ? 1 : 0), 0);
    return { item, index, score };
  }).sort((a, b) => b.score - a.score || a.index - b.index);
  const matched = scored.filter((entry) => entry.score > 0).slice(0, 2).map((entry) => entry.item);
  return matched.length ? matched : knowledge.filter((item) => ['Platform overview', 'Registration and custom solutions'].includes(item.topic)).slice(0, 2);
};

const generateLandingAssistantReply = async (message) => {
  const knowledge = await getApprovedKnowledge();
  const matches = selectKnowledge(knowledge, message);
  const answer = matches.length
    ? matches.map((item) => item.content).join(' ')
    : 'I can help with Audito plans, audit workflows, checklists, evidence, corrective actions, organization structure, and custom solutions. Please try one of the suggested questions or contact Audito for more help.';
  const actionKeys = findActions(message);
  const fallbackActions = actionKeys.length ? actionKeys : ['features', 'contact'];
  return { answer: answer.slice(0, 1200), actions: fallbackActions.map((key) => ACTIONS[key]) };
};

module.exports = { generateLandingAssistantReply };
