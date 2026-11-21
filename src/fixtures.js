import examples from './examples.json' with { type: 'json' };

export const CASES = examples;

// Reusable templates for generic expense, income, and foreign-bill calculations.
export const CUSTOM_CASES = [
  {
    id: 'expense',
    title: 'A planned expense whose price could jump',
    samplePrompt: 'What if the price of flour rises before my bakery buys its next shipment?',
    followUp: {
      question: 'How many units will you buy, and what prices are you budgeting and stress-testing? Use a quantity of 1 to compare whole-period totals.',
      kind: 'fields',
      inputs: [
        { name: 'quantity', label: 'Quantity to buy', default: 1, unit: 'units' }
      ]
    },
    period: 'Until the purchase is paid',
    riskSummary: 'Extra dollars spent if the price you pay lands above your baseline.',
    impactType: 'expense',
    inputs: [
      { name: 'quantity', label: 'Quantity to buy', default: 1, unit: 'units' },
      { name: 'baselinePrice', label: 'Baseline price per unit', default: '', unit: '$/unit' },
      { name: 'stressPrice', label: 'Stress price per unit', default: '', unit: '$/unit' }
    ],
    company: null,
    defaultPosition: 1000,
    scenarios: [
      {
        id: 'rises-with-cost', kind: 'paper',
        label: 'The price spike arrives and the fictional asset rises with it',
        reason: 'This synthetic scenario assumes the paper position gains over the purchase period. You can change the return below.',
        returnPct: 20
      },
      {
        id: 'falls-with-cost', kind: 'paper',
        label: 'The same price spike arrives and the fictional asset falls anyway',
        reason: 'This synthetic scenario assumes the position falls while the purchase gets more expensive.',
        returnPct: -15,
        isFailure: true
      }
    ]
  },
  {
    id: 'income',
    title: 'Income that depends on a price holding up',
    samplePrompt: 'What if my teaching fee falls before I book next month’s classes?',
    followUp: {
      question: 'How many units will you sell, and what prices are you expecting and stress-testing? Use a quantity of 1 to compare whole-period totals.',
      kind: 'fields',
      inputs: [
        { name: 'quantity', label: 'Quantity to sell', default: 1, unit: 'units' }
      ]
    },
    period: 'Until you are paid',
    riskSummary: 'Dollars of income lost if the price you receive falls below your baseline.',
    impactType: 'income',
    inputs: [
      { name: 'quantity', label: 'Quantity to sell', default: 1, unit: 'units' },
      { name: 'baselinePrice', label: 'Baseline price per unit', default: '', unit: '$/unit' },
      { name: 'stressPrice', label: 'Stress price per unit', default: '', unit: '$/unit' }
    ],
    company: null,
    defaultPosition: 1000,
    scenarios: [
      {
        id: 'rises-as-income-falls', kind: 'paper',
        label: 'The price you receive falls and the fictional asset rises in the same move',
        reason: 'This synthetic scenario assumes the paper position gains during the period when your income falls.',
        returnPct: 20
      },
      {
        id: 'falls-with-income', kind: 'paper',
        label: 'The price you receive falls and the fictional asset falls with it',
        reason: 'This synthetic scenario assumes the position loses value during the same period as your income loss.',
        returnPct: -15,
        isFailure: true
      }
    ]
  },
  {
    id: 'fx-bill',
    title: 'A bill due in a foreign currency',
    samplePrompt: 'I owe a supplier euros in March. What if the euro rises before I pay?',
    followUp: {
      question: 'How much is due, and which exchange rates are you budgeting and stress-testing? Enter both rates in foreign currency units per US dollar.',
      kind: 'fields',
      inputs: [
        { name: 'foreignDue', label: 'Amount due', default: '', unit: 'foreign units' }
      ]
    },
    period: 'Until the foreign bill is due',
    riskSummary: 'Change in the dollar cost of a future foreign-currency bill if the exchange rate moves.',
    impactType: 'fx-bill',
    inputs: [
      { name: 'foreignDue', label: 'Amount due', default: '', unit: 'foreign units' },
      { name: 'budgetRate', label: 'Budgeted exchange rate', default: '', unit: 'foreign units per US dollar' },
      { name: 'scenarioRate', label: 'Scenario exchange rate', default: '', unit: 'foreign units per US dollar' }
    ],
    company: null,
    defaultPosition: 1000,
    scenarios: [
      {
        id: 'hold-foreign', kind: 'foreign-cash',
        label: 'Convert your position to the foreign currency now and hold until the bill is due',
        reason: 'Holding the invoice currency offsets the exchange-rate change on the portion of the bill you cover.',
        returnPct: 'calculated'
      },
      {
        id: 'paper-rises', kind: 'paper',
        label: 'The paper position gains as the bill grows',
        reason: 'This synthetic scenario assumes a positive return during the currency move.',
        returnPct: 12
      },
      {
        id: 'paper-falls', kind: 'paper',
        label: 'The paper position falls as the bill grows',
        reason: 'This synthetic scenario assumes the position falls during the currency move.',
        returnPct: -12,
        isFailure: true
      }
    ]
  }
];

export const ASSUMPTIONS = [
  'Paper positions use unborrowed funds.',
  'Cash earns zero interest by assumption.',
  'Each stock outcome is hypothetical — assumed returns are invented for the simulation.',
  'The currency benchmark uses your two exchange rates and assumes zero interest and conversion fees.',
  'This app asks for no financial account, places no trades, and gives no personalized buy list.'
];
