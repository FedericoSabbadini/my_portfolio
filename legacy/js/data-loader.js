/**
 * Data Loader Module
 * Handles loading JSON data files with caching
 */

class DataLoader {
    constructor() {
        this.cache = {};
        this.basePath = 'data/';
    }

    /**
     * Load data from a JSON file
     * @param {string} filename - JSON filename (without .json extension)
     * @param {boolean} useCache - Whether to use cached data
     * @returns {Promise<Object|null>}
     */
    async load(filename, useCache = true) {
        if (useCache && this.cache[filename]) {
            return this.cache[filename];
        }

        try {
            const response = await fetch(`${this.basePath}${filename}.json`);
            if (!response.ok) {
                throw new Error(`Failed to load ${filename}.json`);
            }
            
            const data = await response.json();
            this.cache[filename] = data;
            return data;
        } catch (error) {
            console.error(`DataLoader Error [${filename}]:`, error);
            return null;
        }
    }

    /**
     * Load multiple data files at once
     * @param {Array<string>} filenames - Array of filenames
     * @returns {Promise<Object>}
     */
    async loadMultiple(filenames) {
        const results = await Promise.all(
            filenames.map(f => this.load(f))
        );
        
        const data = {};
        filenames.forEach((name, index) => {
            data[name] = results[index];
        });
        return data;
    }

    /**
     * Clear cache
     * @param {string|null} filename - Specific file to clear, or null for all
     */
    clearCache(filename = null) {
        if (filename) {
            delete this.cache[filename];
        } else {
            this.cache = {};
        }
    }

    /**
     * Get cached data without fetching
     * @param {string} filename
     * @returns {Object|null}
     */
    getCached(filename) {
        return this.cache[filename] || null;
    }
}

// Export singleton instance
window.DataLoader = new DataLoader();
