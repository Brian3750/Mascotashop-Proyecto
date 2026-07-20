import pkg from "transbank-sdk";

const { WebpayPlus, Options, IntegrationCommerceCodes, IntegrationApiKeys, Environment } = pkg as any;

// NOTA: sigue usando las credenciales de INTEGRACIÓN (ambiente de pruebas) de Transbank,
// igual que en el server.ts original. Para producción real con cobros de verdad,
// hay que reemplazar Environment.Integration por Environment.Production y usar
// el código de comercio + api key reales que entrega Transbank tras el proceso de afiliación.
export const tx = new WebpayPlus.Transaction(
  new Options(IntegrationCommerceCodes.WEBPAY_PLUS, IntegrationApiKeys.WEBPAY, Environment.Integration)
);
