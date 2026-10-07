export type TransactionType="expense"|"income"|"transfer"|"adjustment";
export interface AccountBalance{id:string;balanceMinor:number;includeInTotal?:boolean;}
export interface FinanceTransaction{type:TransactionType;amountMinor:number;accountId:string;destinationAccountId?:string|null;isMandatory?:boolean;}
export interface ForecastItem{type:"income"|"expense";amountMinor:number;}
export interface SafeToSpendInput{liquidBalanceMinor:number;obligationsUntilNextIncomeMinor:number;reservedGoalMoneyMinor:number;minimumEmergencyReserveMinor:number;}
export interface GoalProjectionInput{targetMinor:number;savedMinor:number;monthsRemaining:number;}
export interface BudgetProjectionInput{spentMinor:number;budgetMinor:number;elapsedDays:number;totalDays:number;}
