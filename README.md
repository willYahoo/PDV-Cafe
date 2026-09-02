# PDV Cafeteria

Base independente do PDV, adaptada para operação de cafeteria.

## Principais diferenças

- Produtos podem ser vendidos por unidade, peso ou volume, com quantidades de até três casas decimais.
- Comandas permitem abrir mesa/balcão, lançar itens e fechar gerando um pedido com baixa de estoque.
- Cada pedido reserva os campos de situação fiscal e a API expõe uma configuração segura em `GET /api/fiscal/config`.

## Fiscal

Nenhum documento fiscal é emitido sem a configuração explícita de um provedor. Defina as variáveis do arquivo `back-end/.env.example` após escolher o emissor e instalar o respectivo adaptador. As credenciais devem permanecer somente no servidor.

## Execução local

Em terminais separados:

```bash
cd back-end && npm install && npm run dev
cd front-end && npm install && npm run dev
```

Crie `back-end/.env` a partir de `.env.example` e informe a conexão MongoDB antes de iniciar a API.
