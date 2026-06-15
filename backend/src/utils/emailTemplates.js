const path = require('path');
const fs = require('fs');

function getEmailTemplate({ title, subtitle, content }) {
  const logoPath = path.join(__dirname, '../public/audito-logo-white.png');
  const logoExists = fs.existsSync(logoPath);

  const headerLogo = logoExists
    ? `<img src="cid:audito-logo" alt="AUDITO" style="height: 50px; width: auto; display: block; margin: 0 auto;" />`
    : `<div style="font-weight: 800; letter-spacing: 2px; font-size: 24px;">AUDITO</div>`;

  const template = {
    html: `
      <div style="font-family: 'Inter', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: #12B572; color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
          <div style="margin-bottom: 15px;">${headerLogo}</div>
          <h2 style="margin: 0; font-size: 28px;">${title}</h2>
          <p style="margin: 10px 0 0 0; opacity: 0.9;">${subtitle}</p>
        </div>
        <div style="background: white; padding: 30px; border-radius: 0 0 10px 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
          ${content}
          <div style="margin-top: 30px; padding-top: 20px; border-top: 2px solid #12B572; text-align: center;">
            <p style="color: #00374B; font-weight: 600; margin: 0;">Best regards,</p>
            <p style="color: #12B572; font-weight: 600; margin: 5px 0;">Audito Team</p>
            <p style="color: #999; font-size: 12px; margin: 10px 0 0 0;">Powered by Valuecraft Minds.</p>
          </div>
        </div>
      </div>
    `,
    attachments: [],
  };

  if (logoExists) {
    template.attachments.push({
      filename: 'audito-logo-white.png',
      path: logoPath,
      cid: 'audito-logo',
    });
  }

  return template;
}

module.exports = {
  getEmailTemplate,
};
