

# Add Processing Fees to Heather's Subscriptions

## Current State
Heather has two active subscriptions with no processing fees:
- **Monthly dues**: Silver $200/mo (`sub_1SynrZLyZrsSqLhsJon2Pk7k`)
- **Annual fee**: $300/yr (`sub_1SygPYLyZrsSqLhshEA7Pfdv`)

You will handle the $100 refund yourself separately.

## Steps

### Step 1: Create recurring processing fee prices
- **$6.29/mo** processing fee for the $200/mo subscription (product: `prod_UIlCLcsYb1yhUU`)
- **$9.28/yr** processing fee for the $300/yr subscription (product: `prod_UIlCLcsYb1yhUU`)

### Step 2: Add fee items to both subscriptions
- Add the $6.29/mo price to `sub_1SynrZLyZrsSqLhsJon2Pk7k` with `proration_behavior: none` (takes effect next billing cycle)
- Add the $9.28/yr price to `sub_1SygPYLyZrsSqLhshEA7Pfdv` with `proration_behavior: none`

## Result
Heather's future invoices will include the processing fee line items:
- Monthly: $200 + $6.29 = **$206.29**
- Annual: $300 + $9.28 = **$309.28**

