import { CopyButton } from "@/components/CopyButton";
import { TESLLAMA_CA } from "@/lib/tesllama-token";

export function ContractAddress() {
  return (
    <div className="tesllama-contract">
      <span className="contract-label">Contract address</span>
      <div className="contract-value">
        <code>{TESLLAMA_CA}</code>
        <CopyButton value={TESLLAMA_CA} />
      </div>
    </div>
  );
}
