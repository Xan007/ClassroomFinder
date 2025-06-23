const core = require('@actions/core');
const { chromium } = require('playwright');
require('dotenv').config();

(async () => {
  const usuario = process.env.SIAU_USR;
  const contrasena = process.env.SIAU_PWD;
  const baseUrl = process.env.SIAU_URL;

  let isLoggedIn = false;
  let page = null;
  let browser = null;

  try {
    browser = await chromium.launch({ headless: true });
    page = await browser.newPage();

    // Bloquear recursos innecesarios
    await page.route('**/*', route => {
      const blocked = ['image', 'stylesheet', 'font', 'media'];
      if (blocked.includes(route.request().resourceType())) return route.abort();
      return route.continue();
    });

    await page.goto(`${baseUrl}/ORION/Login`);
    await page.fill('#usr', usuario);
    await page.fill('#pwd', contrasena);
    await Promise.all([
      page.waitForLoadState('domcontentloaded'),
      page.click('//*[@id="Submit"]'),
    ]);

    if (!page.url().includes('/Home')) {
      throw new Error(`Login fallido: redireccionó a ${page.url()}`);
    }

    isLoggedIn = true;

    core.info('✅ Login exitoso');
    await page.goto(`${baseUrl}/ORION/HorarioGeneral`);
  
    await page.waitForSelector('select#facultad');

    const facultades = await page.$$eval('select#facultad > option', options =>
      options.map(o => ({ value: o.value, label: o.textContent.trim() })).filter(o => o.value !== '0')
    );

    for (const facultad of facultades) {
      await page.selectOption('select#facultad', facultad.value);

      const programas = await page.$$eval('select#programa1 > option', options =>
        options.map(o => ({ value: o.value, label: o.textContent.trim() })).filter(o => o.value !== '0')
      );

      for (const programa of programas) {
        await page.selectOption('select#programa1', programa.value);

        const numeroSemestres = programa.value.split(' ')[1] || '?';
        core.info(`📚 ${facultad.label} > ${programa.label} > ${numeroSemestres} Semestres`);
      }
    } 

    core.info('✅ Scraping finalizado');
  } catch (error) {
    core.setFailed(`❌ Error en el scraping: ${error.message}`);
  } finally {
    if (page && page.isClosed() === false) {
      try {
        await page.goto(`${baseUrl}/ORION/Logout`, { timeout: 3000 });
        core.info('🔒 Logout exitoso');
      } catch (_) {
        core.warning('⚠️ No se pudo hacer logout correctamente.');
      }
    }

    if (browser) await browser.close();
  }
})();
