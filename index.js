require('dotenv').config();
const express = require('express');
const axios = require('axios');
const app = express();
app.use(express.json());

function authenticateApiKey(req, res, next) {
  const apiKey = req.body.apiKey;

  if (!apiKey || apiKey.trim() !== process.env.BOT_API_KEY?.trim()) {
    return res.status(403).json({ success: false, error: 'API Key inválida' });
  }
  next();
}

const CHANNEL_MAP = {
  'Events': 698,
  'Events_Referral_Ambassadors': 976,
  'Referral_Ambassadors': 6
};

const PORTFOLIO_MAP = {
  'Digital_Sales': 725,
  'Strategic_Accounts': 726,
  'Growth': 727,
  'Clientes_da_base': 938
};

const EVENTO_MAP = {
  'ABRAINC': 1010
};

const BDR_MAP = {
  'Evento_BDR': 949,
  'BDR': 950,
  'Nao_Aplicavel': 951
};

const TERRITORY_MAP = {
  'CPG': 728,
  'Education': 729,
  'Finance': 730,
  'Healthcare': 731,
  'Real_Estate': 732,
  'Retail': 733,
  'Utilities': 734,
  'Hospitality': 882,
  'Ecommerce': 883,
  'Telco': 884,
  'Automotive': 885,
  'Insurance': 886,
  'Auto_Parts': 887,
  'Government': 888,
  'Marketplace': 889,
  'Gaming_Glambly': 890,
  'Travel': 891
};

const USE_CASE_MAP = {
  'Collaboration': 708,
  'Conversational_Commerce': 709,
  'Customer_Support': 710,
  'Marketing_Campaign': 711,
  'Lead_Generation': 893,
  'Customer_Care': 895,
  'Engagement': 896,
  'Booking_confirmation': 897,
  'Payment_Reminder': 898,
  'Fiel_Services': 899
};

app.get('/', (req, res) => {
  res.json({ status: 'ok' });
});

app.post('/criar-lead-pipedrive', authenticateApiKey, async (req, res) => {
  const { nome, email, telefone, empresa, evento, origem, portfolio, timeDestino, observacao, envolvimentoBdr, territory, useCase, nextSteps } = req.body || {};

  if (!nome || !telefone) {
    return res.status(400).json({ success: false, error: 'nome e telefone são obrigatórios' });
  }

  const TOKEN = process.env.PIPEDRIVE_TOKEN;
  const BASE = 'https://api.pipedrive.com/v1';
  const channelId = CHANNEL_MAP[origem] || null;
  const portfolioId = PORTFOLIO_MAP[portfolio] || null;
  const eventoId = EVENTO_MAP[evento] || null;
  const bdrId = BDR_MAP[envolvimentoBdr] || null;
  const territoryId = TERRITORY_MAP[territory] || null;
  const useCaseId = USE_CASE_MAP[useCase] || null;

  try {
    let orgId = null;
    if (empresa) {
      const orgResp = await axios.post(`${BASE}/organizations?api_token=${TOKEN}`, { name: empresa });
      if (orgResp.data.success) {
        orgId = orgResp.data.data.id;
      } else {
        console.log('Erro ao criar organização:', orgResp.data);
      }
    }

    const personPayload = {
      name: nome,
      email: [{ value: email || '', primary: true, label: 'work' }],
      phone: [{ value: telefone, primary: true, label: 'mobile' }]
    };
    if (orgId) personPayload.org_id = orgId;

    const personResp = await axios.post(`${BASE}/persons?api_token=${TOKEN}`, personPayload);
    if (!personResp.data.success) {
      console.log('Erro ao criar pessoa:', personResp.data);
      return res.status(500).json({ success: false, error: 'Erro ao criar pessoa no Pipedrive', detail: personResp.data });
    }

    const personId = personResp.data.data.id;

    const dealPayload = {
      title: `${empresa || nome}`,
      person_id: personId,
      org_id: orgId || null,
      pipeline_id: 62,
      stage_id: 583,
      'c30b6329c9a5cb3f8b1e244196cb43af0470f6e0': portfolioId,
      'f563ad035a06aaa1ccf4042322d37a62c3a179d3': eventoId,
      '8519ab238b5ac31d1e9e61b9670ae8023a127f5d': bdrId ? [bdrId] : null,
      'f0a6b9fe297a1cfe8162b0b786c69d54b7292e48': territoryId,
      '7e6d223748b05b5ff35dd8327ce176ff6f0f1163': useCaseId,
      '09d7bdacadb2432b04e8592aa410b211d5ea4331': nextSteps || null
    };
    if (channelId) dealPayload.channel = channelId;

    const dealResp = await axios.post(`${BASE}/deals?api_token=${TOKEN}`, dealPayload);
    if (!dealResp.data.success) {
      console.log('Erro ao criar deal:', dealResp.data);
      return res.status(500).json({ success: false, error: 'Erro ao criar deal no Pipedrive', detail: dealResp.data });
    }

    const dealId = dealResp.data.data.id;

    const noteResp = await axios.post(`${BASE}/notes?api_token=${TOKEN}`, {
      content: `Time destino: ${timeDestino || ''}\nObservação: ${observacao || ''}`,
      deal_id: dealId
    });

    if (!noteResp.data.success) {
      console.log('Erro ao criar nota:', noteResp.data);
    }

    return res.json({ success: true, deal_id: dealId, person_id: personId, org_id: orgId });

  } catch (error) {
    console.log('Erro detalhado:', error.response?.data || error.message);
    return res.status(500).json({ success: false, error: error.message, detail: error.response?.data || null });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
