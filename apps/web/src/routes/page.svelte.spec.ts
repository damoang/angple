import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import Page from './+page.svelte';

describe('/+page.svelte', () => {
    it('should render without errors', async () => {
        const { container } = render(Page);
        expect(container).toBeTruthy();
    });
});
