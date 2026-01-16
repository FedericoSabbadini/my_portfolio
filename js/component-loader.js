/**
 * Component Loader Module
 * Loads HTML components dynamically
 */

class ComponentLoader {
    constructor() {
        this.components = {};
        this.basePath = 'components/';
    }

    /**
     * Load a single component
     * @param {string} name - Component name
     * @param {string} targetId - Target element ID
     * @returns {Promise<boolean>}
     */
    async loadComponent(name, targetId) {
        try {
            const response = await fetch(`${this.basePath}${name}.html`);
            if (!response.ok) {
                throw new Error(`Component ${name} not found`);
            }
            
            const html = await response.text();
            this.components[name] = html;
            
            const target = document.getElementById(targetId);
            if (target) {
                target.innerHTML = html;
                this.executeScripts(target);
                return true;
            }
            return false;
        } catch (error) {
            console.error(`ComponentLoader Error [${name}]:`, error);
            return false;
        }
    }

    /**
     * Execute scripts in loaded component
     * @param {Element} container
     */
    executeScripts(container) {
        const scripts = container.getElementsByTagName('script');
        for (let script of scripts) {
            const newScript = document.createElement('script');
            if (script.src) {
                newScript.src = script.src;
            } else {
                newScript.textContent = script.textContent;
            }
            script.parentNode.replaceChild(newScript, script);
        }
    }

    /**
     * Load multiple components
     * @param {Array<{name: string, targetId: string}>} components
     * @returns {Promise<boolean[]>}
     */
    async loadComponents(components) {
        return Promise.all(
            components.map(c => this.loadComponent(c.name, c.targetId))
        );
    }

    /**
     * Get cached component HTML
     * @param {string} name
     * @returns {string|null}
     */
    getComponent(name) {
        return this.components[name] || null;
    }
}

// Export singleton instance
window.ComponentLoader = new ComponentLoader();
