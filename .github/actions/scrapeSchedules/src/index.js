const core = require('@actions/core');
const { chromium } = require('playwright');

(async () => {
  const usuario = core.getInput('username');
  const contrasena = core.getInput('password');
  const baseUrl = core.getInput('base-url');

  try {
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();

    const cleanBaseUrl = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;

    await page.goto(cleanBaseUrl);
    await page.fill('#usr', usuario);
    await page.fill('#pwd', contrasena);
    await page.click('button[type="submit"]');
    await page.waitForLoadState('networkidle');

    const currentUrl = page.url();
    if (!currentUrl.includes('/Home')) {
      await browser.close();
      return core.setFailed(`❌ Login fallido. Redirigió a: ${currentUrl}`);
    }

    core.info('✅ Login exitoso.');

    await page.goto(`${cleanBaseUrl}HorarioGeneral`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('select#facultad');

    const facultades = await page.$$eval('select#facultad > option', options =>
      options.map(o => ({ value: o.value, label: o.textContent.trim() })).filter(o => o.value !== '0')
    );

    for (const facultad of facultades) {
      await page.selectOption('select#facultad', facultad.value);
      await page.waitForTimeout(1000);

      const programas = await page.$$eval('select#programa1 > option', options =>
        options.map(o => ({ value: o.value, label: o.textContent.trim() })).filter(o => o.value !== '0')
      );

      for (const programa of programas) {
        await page.selectOption('select#programa1', programa.value);
        await page.waitForTimeout(800);

        for (let semestre = 1; semestre <= 10; semestre++) {
          await page.selectOption('select#semestre', semestre.toString());
          await page.waitForTimeout(500);

          core.info(`📘 Facultad=${facultad.label}, Programa=${programa.label}, Semestre=${semestre}`);
        }
      }
    }

    await browser.close();
    core.info("🎉 Scraping finalizado correctamente.");
  } catch (error) {
    core.setFailed(`❌ Error durante scraping: ${error.message}`);
  }
})();
