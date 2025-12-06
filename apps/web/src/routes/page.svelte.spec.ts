import { page } from '@vitest/browser/context';
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import Page from './+page.svelte';

describe('/+page.svelte', () => {
    it('should render page container', async () => {
        render(Page);

        const container = page.getByRole('main').locator('.container');
        await expect.element(container).toBeInTheDocument();
    });
});
