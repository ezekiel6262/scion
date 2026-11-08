import { DomainError } from './domain.ts';
import { hash, signToken, verifyToken } from './crypto.ts';

type TxAction={FunctionCall?:{method_name:string;args:string;deposit:string}};
export class NearTransactionVerifier {
  private secret:string;private usdcContract:string;private treasury:string;private now:()=>Date;private rpcUrl:string;
  constructor(secret:string,usdcContract:string,treasury:string,now=()=>new Date(),rpcUrl='https://rpc.mainnet.fastnear.com'){this.secret=secret;this.usdcContract=usdcContract;this.treasury=treasury;this.now=now;this.rpcUrl=rpcUrl;}
  async verifyPayment(actor:string,input:any){
    const plan=this.checkoutPlan(actor,input?.checkoutPlan),tx=await this.transaction(actor,input?.txHash);
    if(tx.transaction.receiver_id!==this.usdcContract)throw new DomainError('transaction_receiver_mismatch','Transaction receiver is not the configured USDC contract',422);
    const actual=(tx.transaction.actions as TxAction[]).map(value=>value.FunctionCall).filter((v):v is NonNullable<TxAction['FunctionCall']>=>v?.method_name==='ft_transfer').map(action=>{const args=this.args(action);return {receiverId:String(args.receiver_id),amountMinor:numberAmount(args.amount)}});
    if(actual.length!==plan.transfers.length||plan.transfers.some((expected:any)=>!actual.some(value=>value.receiverId===expected.receiverId&&value.amountMinor===expected.amountMinor)))throw new DomainError('payment_mismatch','Finalized USDC transfers do not match the signed checkout split',422);
    return this.proof({kind:'near-usdc-payment',sub:actor,txHash:input.txHash,offerId:plan.offerId,contractId:this.usdcContract,protocolReceiver:this.treasury,amountMinor:plan.amountMinor,currency:'USDC',planHash:hash(plan),settledAt:this.now().toISOString()});
  }
  async verifyExecution(actor:string,input:any){
    const tx=await this.transaction(actor,input?.txHash),depositAddress=String(input?.depositAddress??''),amountIn=String(input?.amountIn??'');
    if(!/^[a-z0-9._-]{2,64}$/i.test(depositAddress)||!/^\d+$/.test(amountIn)||BigInt(amountIn)<=0n)throw new DomainError('invalid_execution','Execution details are invalid');
    const action=this.functionCall(tx,'ft_transfer','wrap.near'),args=this.args(action);
    if(args.receiver_id!==depositAddress||String(args.amount)!==amountIn)throw new DomainError('execution_mismatch','Finalized transaction does not match the submitted 1Click deposit',422);
    return this.proof({kind:'near-intents-execution',sub:actor,txHash:input.txHash,depositAddress,amountIn,settledAt:this.now().toISOString()});
  }
  private proof(value:Record<string,unknown>){const exp=new Date(this.now().getTime()+10*60_000).toISOString(),payload=Buffer.from(JSON.stringify({...value,exp})).toString('base64url');return {proof:signToken(payload,this.secret),txHash:value.txHash,settledAt:value.settledAt,expiresAt:exp};}
  private checkoutPlan(actor:string,token:unknown){if(typeof token!=='string')throw new DomainError('checkout_plan_required','A signed checkout plan is required',422);const raw=verifyToken(token,this.secret);if(!raw)throw new DomainError('invalid_checkout_plan','Checkout plan signature is invalid',422);let plan:any;try{plan=JSON.parse(Buffer.from(raw,'base64url').toString())}catch{throw new DomainError('invalid_checkout_plan','Checkout plan is malformed',422)}if(plan.kind!=='checkout-plan'||plan.sub!==actor||plan.contractId!==this.usdcContract||plan.protocolReceiver!==this.treasury||new Date(plan.exp)<=this.now()||!Array.isArray(plan.transfers))throw new DomainError('invalid_checkout_plan','Checkout plan is expired or does not match this wallet',422);return plan;}
  private async transaction(actor:string,txHash:unknown){if(typeof txHash!=='string'||!/^[A-Za-z0-9_-]{20,100}$/.test(txHash))throw new DomainError('invalid_tx_hash','A valid NEAR transaction hash is required');const response=await fetch(this.rpcUrl,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:'scion-tx',method:'tx',params:{tx_hash:txHash,sender_account_id:actor,wait_until:'FINAL'}})});const body=await response.json() as any;if(!response.ok||body.error)throw new DomainError('near_transaction_unavailable','NEAR transaction could not be finalized',422);const tx=body.result;if(tx?.transaction?.signer_id!==actor||!(tx.status?.SuccessValue!==undefined||tx.status?.SuccessReceiptId))throw new DomainError('transaction_not_successful','Transaction is not a finalized success for this wallet',422);return tx;}
  private functionCall(tx:any,method:string,receiver:string){if(tx.transaction.receiver_id!==receiver)throw new DomainError('transaction_receiver_mismatch','Transaction receiver is not approved',422);const action=(tx.transaction.actions as TxAction[]).find(value=>value.FunctionCall?.method_name===method)?.FunctionCall;if(!action)throw new DomainError('transaction_action_missing','Expected token transfer action was not found',422);return action;}
  private args(action:{args:string}){try{return JSON.parse(Buffer.from(action.args,'base64').toString()) as Record<string,unknown>}catch{throw new DomainError('transaction_args_invalid','Transaction action arguments are invalid',422)}}
}
function numberAmount(value:unknown){if(typeof value!=='string'||!/^\d+$/.test(value)){throw new DomainError('invalid_payment_amount','Token transfer amount is invalid',422)}const n=Number(value);if(!Number.isSafeInteger(n))throw new DomainError('invalid_payment_amount','Token transfer amount is outside the supported range',422);return n;}
