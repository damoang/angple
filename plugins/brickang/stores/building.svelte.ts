/**
 * 건축물 상태 (Svelte 5 Rune).
 */
import { brickangApi, type BuildingDto, type BrickDto } from '../lib/api.js';

class BuildingStore {
    building = $state<BuildingDto | null>(null);
    bricks = $state<BrickDto[]>([]);
    loading = $state(false);
    error = $state<string | null>(null);

    progress = $derived(this.building?.progress_percent ?? 0);

    async loadActive(): Promise<void> {
        this.loading = true;
        this.error = null;
        try {
            const res = await brickangApi.getActive();
            this.building = res.building;
            this.bricks = res.recent;
        } catch (err) {
            this.error = (err as Error).message;
        } finally {
            this.loading = false;
        }
    }

    async loadBuilding(id: number): Promise<void> {
        this.loading = true;
        this.error = null;
        try {
            const b = await brickangApi.getBuilding(id);
            this.building = b;
            const res = await brickangApi.getBuildingBricks(id, { limit: 5000 });
            this.bricks = res.bricks;
        } catch (err) {
            this.error = (err as Error).message;
        } finally {
            this.loading = false;
        }
    }

    addBricks(newBricks: BrickDto[]): void {
        this.bricks = [...newBricks, ...this.bricks];
        if (this.building) {
            this.building = {
                ...this.building,
                current_bricks: this.building.current_bricks + newBricks.length
            };
        }
    }
}

export const buildingStore = new BuildingStore();
