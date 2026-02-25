# BloodMap

<p align="center">
  <img src="https://github.com/paulo-pnj1/BloodMap/blob/ca754feff3c8a642a4d8ad9e62ffa9684b9fb911/bloodmap-icon.png" alt="BloodMap" width="100"/>
  <br>
  <strong>Localização rápida de doadores de sangue por geolocalização</strong>
</p>

BloodMap é uma aplicação móvel multiplataforma que conecta hospitais a doadores de sangue voluntários em tempo real, reduzindo drasticamente o tempo de resposta em emergências médicas.

Focado inicialmente no **Hospital Geral do Uíge**, Angola, o sistema permite encontrar doadores compatíveis próximos com base em tipo sanguíneo e localização geográfica.

## Principais Benefícios

- Reduz atrasos críticos em transfusões de emergência  
- Aumenta a taxa de resposta a pedidos urgentes de sangue  
- Promove doação voluntária regular através de notificações inteligentes  
- Funciona com conectividade limitada (sincronização offline → online)

## Funcionalidades

- Cadastro simples de doadores (tipo sanguíneo, contacto, localização)  
- Solicitação urgente de sangue por parte do hospital  
- Busca geolocalizada com filtros por compatibilidade e distância  
- Notificações push automáticas para doadores elegíveis  
- Mapa interativo com visualização de doadores próximos  
- Autenticação segura e proteção de dados sensíveis

## Tecnologias

| Camada              | Tecnologia              | Propósito principal                          |
|---------------------|-------------------------|----------------------------------------------|
| Frontend Mobile     | React Native + Expo     | App nativa para Android e iOS                |
| Backend & Banco     | Firebase                | Autenticação, Realtime DB, Cloud Messaging   |
| Geolocalização      | Google Maps API         | Mapas, geofencing e cálculo de distância     |
| Desenvolvimento     | Visual Studio Code      | IDE principal                                |
| Modelagem           | UML                     | Documentação de arquitetura e fluxos         |

## Como Testar / Rodar Localmente

### Pré-requisitos
- Node.js ≥ 18  
- Expo CLI (`npm install -g expo-cli`)  
- Projeto Firebase configurado (Authentication + Firestore + FCM)  
- Chave válida da Google Maps API

### Passos rápidos

```bash
# 1. Clone o repositório
git clone https://github.com/SEU-USUARIO/bloodmap.git
cd bloodmap

# 2. Instale dependências
npm install

# 3. Configure Firebase e Google Maps (veja /docs/setup.md)

# 4. Inicie o projeto
npx expo start
