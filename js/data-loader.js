/**
 * Data Loader
 * Loads JSON data files for dynamic content
 */

class DataLoader {
    constructor() {
        this.cache = {};
    }

    /**
     * Load data from JSON file
     * @param {string} filename - JSON filename (without .json extension)
     * @param {boolean} useCache - Use cached data if available
     */
    async load(filename, useCache = true) {
        // Check cache
        if (useCache && this.cache[filename]) {
            return this.cache[filename];
        }

        try {
            const response = await fetch(`data/${filename}.json`);
            if (!response.ok) {
                throw new Error(`Data file ${filename}.json not found`);
            }
            
            const data = await response.json();
            this.cache[filename] = data;
            return data;
        } catch (error) {
            console.error(`Error loading data ${filename}:`, error);
            return null;
        }
    }

    /**
     * Load multiple data files
     * @param {Array} filenames - Array of filenames
     */
    async loadMultiple(filenames) {
        const promises = filenames.map(f => this.load(f));
        const results = await Promise.all(promises);
        
        // Return as object with filename keys
        const data = {};
        filenames.forEach((name, i) => {
            data[name] = results[i];
        });
        return data;
    }

    /**
     * Clear cache
     * @param {string} filename - Optional specific file to clear
     */
    clearCache(filename = null) {
        if (filename) {
            delete this.cache[filename];
        } else {
            this.cache = {};
        }
    }

    /**
     * Get cached data
     * @param {string} filename - Filename to get from cache
     */
    getCached(filename) {
        return this.cache[filename] || null;
    }
}

// Export singleton instance
window.DataLoader = new DataLoader();
