import { LeadFormData, LeadScoreBreakdown, LeadTier } from '../types/lead';

const CATEGORY_TIERS: Record<string, number> = {
  'Car Lifts': 1, '2-Post Lifts': 1, '4-Post Lifts': 1,
  'Mini Excavators': 1, 'Sawmills': 1,
  'Scissor Lifts': 2, 'Tire Changers': 2, 'Wheel Balancers': 2,
  'Wood Chippers': 2, 'Stump Grinders': 2,
  'Pressure Washers': 3, 'Generators': 3, 'Air Compressors': 3,
  'Sheet Metal Brakes': 3,
  'Garage Storage': 4, 'Workbenches': 4, 'Other Heavy Equipment': 4,
};

function parseBudget(budget: string): number {
  if (!budget) return NaN;
  const cleaned = budget.replace(/[$,\s]/g, '').toLowerCase();
  
  if (
    cleaned.includes('unknown') || 
    cleaned.includes('none') || 
    cleaned.includes('undecided') || 
    cleaned.includes('notsure') ||
    cleaned === ''
  ) {
    return NaN;
  }

  // Handle ranges like "5000-10000" or "5k-10k"
  const rangeParts = cleaned.split(/[-–]/);
  if (rangeParts.length > 1) {
    const nums = rangeParts.map(val => {
      const kMatch = val.match(/^(\d+(?:\.\d+)?)[kK]$/);
      if (kMatch) return parseFloat(kMatch[1]) * 1000;
      return parseFloat(val);
    }).filter((n) => !isNaN(n));
    return nums.length > 0 ? Math.max(...nums) : NaN;
  }

  // Handle "10k", "10K"
  const kMatch = cleaned.match(/^(\d+(?:\.\d+)?)[kK]$/);
  if (kMatch) return parseFloat(kMatch[1]) * 1000;
  return parseFloat(cleaned);
}

function calcBudgetScore(targetBudget: string): number {
  const amount = parseBudget(targetBudget);
  if (isNaN(amount)) return 10;
  if (amount >= 10000) return 30;
  if (amount >= 7500) return 28;
  if (amount >= 5000) return 25;
  if (amount >= 3500) return 22;
  if (amount >= 2000) return 18;
  if (amount >= 1500) return 15;
  if (amount >= 1000) return 11;
  if (amount >= 500) return 7;
  return 4;
}

function calcCategoryScore(category: string): number {
  const tier = CATEGORY_TIERS[category] || 4;
  switch (tier) {
    case 1: return 28;
    case 2: return 23;
    case 3: return 15;
    case 4: return 8;
    default: return 8;
  }
}

function calcIntentScore(formType: string, quantity: number, projectDetails?: string): number {
  let score = 0;
  switch (formType) {
    case 'quote': score = 20; break;
    case 'contact': score = 12; break;
    case 'product_inquiry': score = 8; break;
    default: score = 8;
  }
  if (quantity > 1) score += 3;
  if (projectDetails && projectDetails.length > 50) score += 2;
  return Math.min(score, 25);
}

function calcEngagementScore(source: LeadFormData['source']): number {
  let score = 0;
  if (!source) return 2;
  if (source.utm_source === 'google' && source.utm_medium === 'cpc') {
    score = 10;
  } else if (source.utm_source === 'google') {
    score = 6;
  } else if (source.utm_source) {
    score = 4;
  } else {
    score = 2;
  }
  if (source.gclid) score += 3;
  if (source.fbclid) score += 2;
  return Math.min(score, 15);
}

export function scoreLead(data: LeadFormData): {
  score: number;
  scoreBreakdown: LeadScoreBreakdown;
  tier: LeadTier;
  scoreReasons: string[];
} {
  const budgetScore = calcBudgetScore(data.targetBudget);
  const categoryScore = calcCategoryScore(data.productCategory);
  const intentScore = calcIntentScore(data.formType, data.quantity, data.projectDetails);
  const engagementScore = calcEngagementScore(data.source);

  const score = Math.min(budgetScore + categoryScore + intentScore + engagementScore, 100);
  
  let tier: LeadTier = 'cold';
  if (score >= 75) {
    tier = 'hot';
  } else if (score >= 50) {
    tier = 'qualified';
  } else if (score >= 30) {
    tier = 'warm';
  } else if (score >= 15) {
    tier = 'cold';
  } else {
    tier = 'bad_fit';
  }

  const scoreReasons: string[] = [];
  if (budgetScore >= 25) {
    scoreReasons.push('High equipment budget ($5k+)');
  } else if (budgetScore <= 7) {
    scoreReasons.push('Low budget allocation');
  }

  if (categoryScore >= 23) {
    scoreReasons.push('Premium/highly-demanded equipment type');
  } else if (categoryScore <= 8) {
    scoreReasons.push('Utility/accessory equipment category');
  }

  if (intentScore >= 20) {
    scoreReasons.push('Formal quote request submission');
  }

  if (data.source && (data.source.gclid || (data.source.utm_source === 'google' && data.source.utm_medium === 'cpc'))) {
    scoreReasons.push('Acquired via Google Ads CPC campaign');
  }

  return {
    score,
    scoreBreakdown: { budgetScore, categoryScore, intentScore, engagementScore },
    tier,
    scoreReasons,
  };
}
