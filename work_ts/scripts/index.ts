// 回路をwasm実行ファイルにコンパイルする
import initNoirWasm, { acir_read_bytes, compile } from '@noir-lang/noir_wasm';
// 証明バックエンド
import initialiseAztecBackend from '@noir-lang/aztec_backend';
// コンパイラに.nrファイルの場所を教える
import { initialiseResolver } from '@noir-lang/noir-source-resolver';
import { setup_generic_prover_and_verifier, create_proof, verify_proof } from '@noir-lang/barretenberg';

export const compileCircuit = async () => {
  // ブラウザ上でのみ必要
  // ブラウザはWebAssemblyをネイティブにサポートしているため、ブラウザ上で特定のWasmモジュールを初期化する
  // Node.jsのようなサーバーサイドの環境では、このようなブラウザ固有の初期化手順は通常不要
  await initNoirWasm();

  return await fetch(new URL('../src/main.nr', import.meta.url))
    .then(r => r.text())
    .then(code => {
      // ソースコードを返す
      initialiseResolver((id: any) => {
        return code;
      });
    })
    .then(() => {
      try {
        // コンパイルされた回路を返す
        const compiled_noir = compile({});
        return compiled_noir;
      } catch (e) {
        console.log('Error while compiling:', e);
      }
    });
};

// 証明で使用する準備ができた回路のACIRが返される
export const getAcir = async () => {
  // circuit(ACIR) と abi(ABI) を取得
  const { circuit, abi } = await compileCircuit();
  // バックエンドを初期化
  await initialiseAztecBackend();

  // ACIRをバイトとする
  let acir_bytes = new Uint8Array(Buffer.from(circuit, 'hex'));
  // ACIRが返される
  return acir_read_bytes(acir_bytes);
};

const workerFunction = async (event) => {
  try {
      await initialiseAztecBackend();
      const { acir, input } = event.data;
      // 証明者（Prover）と検証者（Verifier）の初期化
      const [prover, verifier] = await setup_generic_prover_and_verifier(acir);
      // proof生成
      const proof = await create_proof(prover, acir, input);
      return { proof, verifier };
  } catch (er) {
      throw er;
  }
};

const verified = async (verifier, proof) => {
  return await verify_proof(verifier, proof);
};

// Test Verification
const testVerification = async () => {
  const acir = await getAcir();
  const { proof, verifier } = await workerFunction({ data: { acir, input: { x: 3, y: 4 } } });
  const result = await verified(verifier, proof);
  console.log({ result });
  console.assert(result, "Verification failed!");
};

testVerification();
