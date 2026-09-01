import twilio from 'twilio';

const ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID || '';
const AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN || '';
const WHATSAPP_FROM = process.env.TWILIO_WHATSAPP_FROM || '';

const client = twilio(ACCOUNT_SID, AUTH_TOKEN);

export async function sendWhatsAppMessage(to: string, body: string) {
  await client.messages.create({
    from: WHATSAPP_FROM,
    to,
    body,
  });
}

export { AUTH_TOKEN };
