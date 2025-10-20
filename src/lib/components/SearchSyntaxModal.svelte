<script lang="ts">
    import Button from './ui/Button.svelte';

    let { 
        isOpen = $bindable(false),
        onUseExample
    }: { 
        isOpen?: boolean;
        onUseExample?: (query: string) => void;
    } = $props();

    function close() {
        isOpen = false;
    }

    function useExample(query: string) {
        if (onUseExample) {
            onUseExample(query);
        }
        close();
    }

    const examples = [
        { query: 'format:epub year:>2020', desc: 'EPUB books after 2020' },
        { query: 'tag:fiction -horror', desc: 'Fiction, no horror' },
        { query: 'author:tolkien "middle earth"', desc: 'Tolkien + "middle earth"' },
        { query: 'year:2015..2023 language:en', desc: 'English books 2015-2023' },
        { query: 'brewing format:pdf', desc: 'PDF brewing books' },
        { query: 'size:>10MB pages:>500', desc: 'Large books, 500+ pages' },
        { query: 'contentType:Magazine', desc: 'Magazine content' },
        { query: 'tag:programming year:>2020 format:epub', desc: 'Recent programming EPUBs' }
    ];
</script>

{#if isOpen}
    <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
    <div 
        class="fixed inset-0 bg-black/50 z-50 flex items-start justify-center p-4 overflow-y-auto" 
        onclick={close}
        onkeydown={(e) => e.key === 'Escape' && close()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="syntax-modal-title"
        tabindex="-1"
    >
        <!-- svelte-ignore a11y_click_events_have_key_events -->
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <div 
            class="bg-white dark:bg-gray-900 rounded-lg shadow-2xl max-w-4xl w-full my-8 max-h-[90vh] overflow-y-auto"
            onclick={(e) => e.stopPropagation()}
        >
            <!-- Header -->
            <div class="sticky top-0 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 px-6 py-4 flex items-center justify-between">
                <h2 id="syntax-modal-title" class="text-2xl font-bold">Search Syntax Reference</h2>
                <button 
                    onclick={close}
                    class="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 text-2xl leading-none"
                    aria-label="Close"
                >
                    ×
                </button>
            </div>

            <!-- Content -->
            <div class="px-6 py-6 space-y-8">
                <!-- Quick Examples -->
                <section>
                    <h3 class="text-xl font-semibold mb-4">Quick Examples (Click to Use)</h3>
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-2">
                        {#each examples as example}
                            <button
                                onclick={() => useExample(example.query)}
                                class="flex flex-col items-start gap-1 p-3 bg-gray-50 dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700 hover:border-blue-500 dark:hover:border-blue-500 transition-colors text-left"
                            >
                                <code class="text-sm font-mono text-blue-600 dark:text-blue-400">
                                    {example.query}
                                </code>
                                <span class="text-xs text-gray-600 dark:text-gray-400">
                                    {example.desc}
                                </span>
                            </button>
                        {/each}
                    </div>
                </section>

                <!-- Basic Field Filters -->
                <section>
                    <h3 class="text-xl font-semibold mb-4">Basic Field Filters</h3>
                    <div class="overflow-x-auto">
                        <table class="w-full text-sm">
                            <thead class="bg-gray-100 dark:bg-gray-800">
                                <tr>
                                    <th class="px-4 py-2 text-left font-medium">Syntax</th>
                                    <th class="px-4 py-2 text-left font-medium">Description</th>
                                    <th class="px-4 py-2 text-left font-medium">Example</th>
                                </tr>
                            </thead>
                            <tbody class="divide-y divide-gray-200 dark:divide-gray-700">
                                <tr>
                                    <td class="px-4 py-2"><code class="text-blue-600 dark:text-blue-400">format:VALUE</code></td>
                                    <td class="px-4 py-2">File format</td>
                                    <td class="px-4 py-2"><code>format:epub</code></td>
                                </tr>
                                <tr>
                                    <td class="px-4 py-2"><code class="text-blue-600 dark:text-blue-400">author:NAME</code></td>
                                    <td class="px-4 py-2">Author name</td>
                                    <td class="px-4 py-2"><code>author:tolkien</code></td>
                                </tr>
                                <tr>
                                    <td class="px-4 py-2"><code class="text-blue-600 dark:text-blue-400">year:YEAR</code></td>
                                    <td class="px-4 py-2">Publication year</td>
                                    <td class="px-4 py-2"><code>year:2020</code></td>
                                </tr>
                                <tr>
                                    <td class="px-4 py-2"><code class="text-blue-600 dark:text-blue-400">tag:NAME</code></td>
                                    <td class="px-4 py-2">Tag substring match</td>
                                    <td class="px-4 py-2"><code>tag:fiction</code></td>
                                </tr>
                                <tr>
                                    <td class="px-4 py-2"><code class="text-blue-600 dark:text-blue-400">language:CODE</code></td>
                                    <td class="px-4 py-2">Language code</td>
                                    <td class="px-4 py-2"><code>language:en</code></td>
                                </tr>
                                <tr>
                                    <td class="px-4 py-2"><code class="text-blue-600 dark:text-blue-400">isbn:NUMBER</code></td>
                                    <td class="px-4 py-2">ISBN exact match</td>
                                    <td class="px-4 py-2"><code>isbn:9781234567890</code></td>
                                </tr>
                                <tr>
                                    <td class="px-4 py-2"><code class="text-blue-600 dark:text-blue-400">publisher:NAME</code></td>
                                    <td class="px-4 py-2">Publisher name</td>
                                    <td class="px-4 py-2"><code>publisher:oreilly</code></td>
                                </tr>
                                <tr>
                                    <td class="px-4 py-2"><code class="text-blue-600 dark:text-blue-400">contentType:TYPE</code></td>
                                    <td class="px-4 py-2">Content type</td>
                                    <td class="px-4 py-2"><code>contentType:Book</code></td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </section>

                <!-- Comparison Operators -->
                <section>
                    <h3 class="text-xl font-semibold mb-4">Comparison Operators</h3>
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <h4 class="font-medium mb-2">Operators</h4>
                            <table class="w-full text-sm">
                                <thead class="bg-gray-100 dark:bg-gray-800">
                                    <tr>
                                        <th class="px-3 py-2 text-left font-medium">Operator</th>
                                        <th class="px-3 py-2 text-left font-medium">Example</th>
                                    </tr>
                                </thead>
                                <tbody class="divide-y divide-gray-200 dark:divide-gray-700">
                                    <tr>
                                        <td class="px-3 py-2"><code>&gt;</code> Greater than</td>
                                        <td class="px-3 py-2"><code>year:&gt;2020</code></td>
                                    </tr>
                                    <tr>
                                        <td class="px-3 py-2"><code>&lt;</code> Less than</td>
                                        <td class="px-3 py-2"><code>year:&lt;2020</code></td>
                                    </tr>
                                    <tr>
                                        <td class="px-3 py-2"><code>&gt;=</code> Greater or equal</td>
                                        <td class="px-3 py-2"><code>year:&gt;=2020</code></td>
                                    </tr>
                                    <tr>
                                        <td class="px-3 py-2"><code>&lt;=</code> Less or equal</td>
                                        <td class="px-3 py-2"><code>year:&lt;=2020</code></td>
                                    </tr>
                                    <tr>
                                        <td class="px-3 py-2"><code>..</code> Range</td>
                                        <td class="px-3 py-2"><code>year:2015..2023</code></td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                        <div>
                            <h4 class="font-medium mb-2">Applicable Fields</h4>
                            <ul class="space-y-2 text-sm">
                                <li><strong>year</strong> - Publication year</li>
                                <li><strong>pages</strong> - Page count</li>
                                <li><strong>size</strong> - File size (MB, GB, KB)</li>
                            </ul>
                            <h4 class="font-medium mb-2 mt-4">Size Examples</h4>
                            <ul class="space-y-1 text-sm">
                                <li><code>size:&gt;10MB</code> - Over 10 MB</li>
                                <li><code>size:&lt;5MB</code> - Under 5 MB</li>
                                <li><code>size:1GB..5GB</code> - 1-5 GB</li>
                            </ul>
                        </div>
                    </div>
                </section>

                <!-- Text Operators -->
                <section>
                    <h3 class="text-xl font-semibold mb-4">Text Search Operators</h3>
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div class="p-4 bg-gray-50 dark:bg-gray-800 rounded">
                            <h4 class="font-medium mb-2">Exact Phrases</h4>
                            <p class="text-sm mb-2">Use quotes for exact phrase matching</p>
                            <code class="text-blue-600 dark:text-blue-400">"machine learning"</code>
                        </div>
                        <div class="p-4 bg-gray-50 dark:bg-gray-800 rounded">
                            <h4 class="font-medium mb-2">Exclusions</h4>
                            <p class="text-sm mb-2">Use minus to exclude terms</p>
                            <code class="text-blue-600 dark:text-blue-400">fiction -horror</code>
                        </div>
                    </div>
                </section>

                <!-- Combining Filters -->
                <section>
                    <h3 class="text-xl font-semibold mb-4">Combining Filters</h3>
                    <p class="text-sm mb-4 text-gray-600 dark:text-gray-400">
                        All filters are combined with implicit AND logic. Space-separate multiple filters.
                    </p>
                    <div class="space-y-3">
                        <div class="p-3 bg-gray-50 dark:bg-gray-800 rounded">
                            <code class="text-blue-600 dark:text-blue-400 text-sm">format:epub year:&gt;2020 tag:fiction</code>
                            <p class="text-xs text-gray-600 dark:text-gray-400 mt-1">
                                Find EPUB fiction books published after 2020
                            </p>
                        </div>
                        <div class="p-3 bg-gray-50 dark:bg-gray-800 rounded">
                            <code class="text-blue-600 dark:text-blue-400 text-sm">brewing format:pdf pages:&gt;200 year:2000..2023</code>
                            <p class="text-xs text-gray-600 dark:text-gray-400 mt-1">
                                Find PDF brewing books with 200+ pages from 2000-2023
                            </p>
                        </div>
                    </div>
                </section>

                <!-- Tips -->
                <section>
                    <h3 class="text-xl font-semibold mb-4">Tips &amp; Best Practices</h3>
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <h4 class="font-medium mb-2 text-green-600 dark:text-green-400">✓ Do</h4>
                            <ul class="text-sm space-y-1 list-disc list-inside">
                                <li>Combine multiple filters</li>
                                <li>Use quotes for exact phrases</li>
                                <li>Use exclusions to narrow results</li>
                                <li>Specify format when known</li>
                                <li>Use ranges for year/page searches</li>
                            </ul>
                        </div>
                        <div>
                            <h4 class="font-medium mb-2 text-red-600 dark:text-red-400">✗ Don't</h4>
                            <ul class="text-sm space-y-1 list-disc list-inside">
                                <li>Use spaces in filter values</li>
                                <li>Forget the colon after field names</li>
                                <li>Combine conflicting filters</li>
                                <li>Mix up field names</li>
                            </ul>
                        </div>
                    </div>
                </section>

                <!-- Pro Tips -->
                <section class="bg-blue-50 dark:bg-blue-900/20 p-4 rounded border border-blue-200 dark:border-blue-800">
                    <h3 class="text-lg font-semibold mb-3">💡 Pro Tips</h3>
                    <ol class="text-sm space-y-2 list-decimal list-inside">
                        <li><strong>Start broad, then narrow:</strong> Begin with <code>brewing</code> then add <code>format:pdf year:&gt;2015</code></li>
                        <li><strong>Tag substring matching:</strong> <code>tag:sci</code> matches "sci-fi", "science", "scientific"</li>
                        <li><strong>Combine text and filters:</strong> Regular search terms work alongside filters</li>
                        <li><strong>Use size units:</strong> <code>10MB</code> is clearer than bytes</li>
                        <li><strong>Try examples:</strong> Click examples above to learn syntax quickly</li>
                    </ol>
                </section>
            </div>

            <!-- Footer -->
            <div class="sticky bottom-0 bg-gray-50 dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 px-6 py-4">
                <Button onclick={close} class="w-full">Close</Button>
            </div>
        </div>
    </div>
{/if}

