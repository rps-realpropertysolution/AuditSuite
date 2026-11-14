/**
 * Lista os empreendimentos do LiveFacilities com id e código — somente leitura.
 *
 *   npm run lf:empreendimentos
 *
 * Grava em scripts/livefacilities/saida/empreendimentos.json (fora do Git).
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { criarClienteLF } from "../../supabase/functions/_shared/livefacilities/cliente.ts";
import { descobrirEmpreendimentos } from "../../supabase/functions/_shared/livefacilities/empreendimentos.ts";

const usuario = process.env.LF_USUARIO;
const senha = process.env.LF_SENHA;
if (!usuario || !senha) {
  console.error("Defina LF_USUARIO e LF_SENHA no arquivo .env.");
  process.exit(1);
}

const cliente = criarClienteLF({ usuario, senha, baseUrl: process.env.LF_BASE_URL || undefined });
const lista = await descobrirEmpreendimentos(cliente);
console.table(lista.map((e) => ({ codigo: e.cdCondominio, id: e.idEmpreendimento, nome: e.nome })));

const pasta = join(process.cwd(), "scripts", "livefacilities", "saida");
mkdirSync(pasta, { recursive: true });
writeFileSync(join(pasta, "empreendimentos.json"), JSON.stringify(lista, null, 2));
console.log(`\n${lista.length} empreendimentos · lista salva em ${join(pasta, "empreendimentos.json")}`);
