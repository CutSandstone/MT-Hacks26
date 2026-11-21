# What Would Hedge This?

## Product

Choose one of three built-in decisions, review its editable assumptions, and test how much a fictional position would offset over the same period.

## Running locally

From the repository root, run `npm start` and open `http://localhost:8000`. Run the JavaScript and Python regression suites with `npm test`.

## Curated decisions

These examples add a sourced company, a specific measurement period, and a follow-up that changes the interpretation.

| Scenario option | Follow-up | What the app measures |
|---|---|---|
| “I'm majoring in CS and want to work in cybersecurity. What if AI changes the entry-level jobs?” | “Which work are you aiming for?” The supported example is a security operations center (SOC) analyst who reviews alerts. | Earnings lost if it takes longer to start paid work |
| “I'm buying a gas car for my commute. Can an energy stock cushion a fuel-price spike?” | “How many miles will you drive this year, and what mileage does the car get?” | Extra dollars spent at the pump |
| “I'm committing to a semester in Japan. What if the yen rises before tuition is due?” | “Is the bill fixed in yen or in US dollars?” | Change in the dollar cost of a future bill |

Use a fictional student and editable example amounts for each decision. Public sources establish a company's business connection. All wages, bills, exchange rates, price changes, and stock returns in the demo are synthetic. Show these two kinds of information separately on screen.

## Reference calculations for the curated decisions

### 1. Entering cybersecurity after a CS degree

**The match.** Surface Palo Alto Networks for the alert-review scenario. Its Cortex XSIAM product automates parts of security operations, and the company describes analysts using it for alert handling and investigations. Those facts also support a competing explanation: a team could adopt the tool and keep its junior analysts. The career outcome and the investment outcome each need their own assumption. [Cortex XSIAM overview](https://www.paloaltonetworks.com/resources/datasheets/cortex-xsiam-aag) · [XSIAM analyst role](https://www.paloaltonetworks.com/services/education/palo-alto-networks-xsiam-analyst)

**Exposure.** Use the first year after graduation. Use $4,500 per month for the cybersecurity job and $3,000 for the alternative job while waiting. A two-month delay costs $3,000 at that $1,500 monthly difference. This measures the earnings difference during the delay. It makes no claim about an entire degree's lifetime value.

| Synthetic scenario | Effect on earnings | Assumed stock return | Gain or loss on $1,000 | Combined change |
|---|---:|---:|---:|---:|
| Employers automate some junior work and the vendor gains customers | −$3,000 | +20% | +$200 | −$2,800 |
| A spending freeze slows both hiring and software sales | −$3,000 | −20% | −$200 | −$3,200 |
| Analysts use the tool and hiring stays on schedule | $0 | +10% | +$100 | +$100 |

**Judge interaction.** Switch between the first two rows. The graduate experiences the same hiring delay, but the cause changes. The stock goes from covering roughly seven cents per dollar lost to adding $200 to the loss. If the student selects a different CS career, ask them to choose a supported example before showing this company match.

### 2. Buying a gas car for a year of commuting

**The match.** Surface Valero as a fuel refiner. Its refining margin depends on the prices of the products it sells and the inputs it buys. A commuter's pump price also includes taxes, distribution, and retail costs. A price increase caused by a local charge can therefore affect the driver without improving the refiner's margin. [Valero annual report, refining segment](https://s23.q4cdn.com/587626645/files/doc_financials/2026/ar/ARS.pdf) · [EIA breakdown of gasoline prices](https://www.eia.gov/energyexplained/gasoline/factors-affecting-gasoline-prices.php)

**Exposure.** The driver expects to travel 12,000 miles over the next year at 30 miles per US gallon. That requires 400 gallons. If fuel averages $4.50 instead of the budgeted $3.50 per gallon, the driver spends $400 extra. Keep the car's purchase price fixed so the screen answers the fuel-budget question.

| Synthetic scenario | Effect on budget | Assumed stock return | Gain or loss on $1,000 | Combined change |
|---|---:|---:|---:|---:|
| Fuel supply tightens and the refiner's margins expand | −$400 | +15% | +$150 | −$250 |
| A local charge raises the same pump price and the stock ends flat | −$400 | 0% | $0 | −$400 |

**Judge interaction.** Change fuel economy from 30 to 40 mpg. The same commute now needs 300 gallons. The fuel shock costs $300 and the $150 paper gain covers half of it. This gives the user a way to compare an investment hypothesis with a change to the purchase itself.

### 3. Committing to tuition priced in Japanese yen

**The match.** Surface Toyota as a company with documented currency exposure. Its filing explains how exchange rates affect its global business. For a direct benchmark, let the user simulate converting the same $1,000 into yen at the start and holding it until tuition is due. This lets the user distinguish owning a Japanese business from owning the currency they will owe. [Toyota annual filing, foreign currency fluctuations](https://global.toyota/pages/global_toyota/ir/library/sec/20-F_202503_final.pdf)

**Exposure.** A ¥600,000 bill is due in six months. Budget at 150 yen per dollar and stress-test 125 yen per dollar. The bill rises from $4,000 to $4,800. Show the unit **yen per US dollar** beside both inputs. Use USD returns for the stock so the engine applies currency conversion only once.

| Synthetic scenario or comparison | Effect on budget | Return over six months | Gain or loss on $1,000 | Combined change |
|---|---:|---:|---:|---:|
| Yen strengthens and Toyota shares fall in dollar terms | −$800 | −10% assumed | −$100 | −$900 |
| Same currency move and strong vehicle sales lift the shares | −$800 | +8% assumed | +$80 | −$720 |
| Hold yen through the same move | −$800 | +20% calculated | +$200 | −$600 |

**Judge interaction.** Switch the invoice to a fixed $4,000 bill payable in dollars. The currency exposure falls to zero. The product should say “Your tuition is already fixed in dollars” and remove the need for a tuition hedge. Cash held in yen can still change value. For this example, assume no conversion fees or interest.

## Features and acceptance criteria

### F1. Enter a decision and confirm the exposure

- **AC1.1** The entry screen offers exactly the three curated decisions and no free-text box.
- **AC1.2** Selecting a decision opens a survey with one question per screen, editable example values, and a Back button. The final answer opens the results.

### F2. Explain why a stock appeared

- **AC2.1** Each candidate card names the company and traces the user's decision to a specific exposure and business activity. Provide a source link for the business fact and a separate label for the assumed return.
- **AC2.2** Every stock has two selectable scenarios with the same adverse event for the user and different outcomes for the stock. Selecting either displays the economic reason being assumed.
- **AC2.3** For each case, compare the same starting dollars and time horizon against holding cash in USD at zero interest. The user can select a $0 paper position. In that case the combined change equals the decision's own change.

### F3. Calculate what the position can cover

- **AC3.1** Show four values with units: the decision's dollar change, the position's gain or loss, their sum, and how much of any loss the position offsets. All rows in the decision tables are reference fixtures.
- **AC3.2** Let the user edit the paper position or assumed stock return. In the first cybersecurity scenario, changing $1,000 to $500 changes the gain from $200 to $100 and the combined result to −$2,900.
- **AC3.3** When the decision loses money and the assumed return is positive, show the hypothetical position size needed to cover the full loss. For a $3,000 loss at +20%, display $15,000. Mark it as conditional arithmetic. For a zero or negative return, explain why no positive holding covers the loss under that assumption.
- **AC3.4** Calculate the yen benchmark from the two exchange rates. At the example rates, $1,000 buys ¥150,000, worth $1,200 at the due date. Changing either rate recomputes both the bill and benchmark.

### F4. Explain uncertainty and failure

- **AC4.1** The screen distinguishes “partially offsets the loss,” “fully covers the loss,” “no effect,” and “increases the loss.” With zero underlying loss, display “no loss to offset” and omit the coverage percentage.
- **AC4.2** An unknown stock return is a valid input. Keep the exposure visible and show the break-even return for the entered position if it is positive. For the $400 fuel shock and $1,000 position, that return is +40%. Leave the combined result unknown until a return is supplied.
- **AC4.3** Reject zero mpg, zero exchange rates, negative position sizes, and stock returns below −100% with field-specific messages. Switching cases resets scenario-specific assumptions and labels.
- **AC4.4** State how the demo handles interest and excessive uncertainty: paper positions use unborrowed funds, cash earns zero interest by assumption, and each stock outcome is hypothetical. Show the counter-scenario alongside the favorable one. The app asks for no financial account, places no trades, and gives no personalized buy list.

## Calculation and implementation

Use one scenario engine. A positive change means money the user keeps or gains. Express the results in USD over the selected horizon.

| Output | Calculation |
|---|---|
| Career impact | −(extra months until hire × monthly earnings difference) |
| Commuting impact | −(annual miles ÷ mpg) × (scenario price − budget price per gallon) |
| Tuition impact, yen invoice | yen due ÷ budget rate − yen due ÷ scenario rate |
| Custom expense impact | quantity × (baseline USD price − stressed USD price) |
| Custom income impact | quantity × (stressed USD payment − baseline USD payment) |
| Foreign bill impact | foreign amount due ÷ budget rate − foreign amount due ÷ scenario rate, both rates in foreign units per USD |
| Stock gain or loss | hypothetical position × assumed USD return for the horizon |
| Holding the invoice currency | hypothetical USD position × (budget rate ÷ scenario rate − 1) |
| Combined change | decision impact + position gain or loss |
| Share of loss offset | position gain ÷ absolute decision loss when the decision loses money. If the position loses money, describe the added loss in dollars. |

Keep the calculation functions independent of the interface. Store per-case prompts, sources, editable defaults, scenario explanations, and expected results in a small fixture file. Round the displayed dollar amounts to cents after calculating. The prototype runs locally with static sources and synthetic data.

## Build sequence and demo

1. **Prove the numbers.** Implement the three exposure functions, the shared position calculation, and tests for every reference row. Cover the fixed-dollar invoice, unknown return, and zero position.
2. **Build one complete flow.** Start with the CS student's prompt, the sourced company match, a comparison to cash, and the button “What would make this fail?” Add the other two cases through the same interface.
3. **Test with a student.** Ask them to explain why the same two-month hiring delay can produce two different combined outcomes. Record which label or assumption needed clarification.
4. **Demo in three minutes.** Pick the commuting decision, edit the fuel assumptions, and compare two paper returns against the $400 cost increase. Switch scenarios to show the economic reason changing. Finish with the Japan example and switch the invoice into dollars to show the exposure disappearing.

**Definition of done.** Each curated example opens directly from the entry screen, retains its reference arithmetic, and works without a network service. Tests cover the scenario picker and the signs and units in each formula.
