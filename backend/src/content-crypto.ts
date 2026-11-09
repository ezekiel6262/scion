import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import type { StrategyVersion } from './domain.ts';

type SealedVersion={sealedVersion:1;alg:'A256GCM';iv:string;tag:string;ciphertext:string};
export class StrategyContentCipher{
  private key:Buffer;
  constructor(secret:string){if(secret.length<32)throw new Error('SCION_DATA_ENCRYPTION_SECRET must contain at least 32 characters');this.key=createHash('sha256').update(secret).digest();}
  seal(value:StrategyVersion):SealedVersion{const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',this.key,iv);cipher.setAAD(Buffer.from(value.id));const ciphertext=Buffer.concat([cipher.update(JSON.stringify(value)),cipher.final()]);return {sealedVersion:1,alg:'A256GCM',iv:iv.toString('base64'),tag:cipher.getAuthTag().toString('base64'),ciphertext:ciphertext.toString('base64')};}
  open(value:StrategyVersion|SealedVersion,id:string):StrategyVersion{if(!(value as SealedVersion).sealedVersion)return value as StrategyVersion;const sealed=value as SealedVersion,decipher=createDecipheriv('aes-256-gcm',this.key,Buffer.from(sealed.iv,'base64'));decipher.setAAD(Buffer.from(id));decipher.setAuthTag(Buffer.from(sealed.tag,'base64'));return JSON.parse(Buffer.concat([decipher.update(Buffer.from(sealed.ciphertext,'base64')),decipher.final()]).toString()) as StrategyVersion;}
}
