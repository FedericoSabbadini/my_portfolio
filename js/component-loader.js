/**
 * Component Loader
 * Loads HTML components dynamically for reusability
 */

class ComponentLoader {
    constructor() {
        this.components = {};
    }

    /**
     * Load a component from file
     * @param {string} name - Component name (navbar, footer, etc)
     * @param {string} targetId - Target element ID to inject component
     */
    async loadComponent(name, targetId) {
        try {
            const response = await fetch(`components/${name}.html`);
            if (!response.ok) {
                throw new Error(`Component ${name} not found`);
            }
            
            const html = await response.text();
            this.components[name] = html;
            
            const target = document.getElementById(targetId);
            if (target) {
                target.innerHTML = html;
                
                // Execute scripts in loaded component if any
                const scripts = target.getElementsByTagName('script');
                for (let script of scripts) {
                    eval(script.innerHTML);
                }
                
                return true;
            }
            return false;
        } catch (error) {
            console.error(`Error loading component ${name}:`, error);
            return false;
        }
    }

    /**
     * Load multiple components
     * @param {Array} components - Array of {name, targetId} objects
     */
    async loadComponents(components) {
        const promises = components.map(c => 
            this.loadComponent(c.name, c.targetId)
        );
        return await Promise.all(promises);
    }

    /**
     * Get loaded component HTML
     * @param {string} name - Component name
     */
    getComponent(name) {
        return this.components[name] || null;
    }
}

// Export singleton instance
window.ComponentLoader = new ComponentLoader();
