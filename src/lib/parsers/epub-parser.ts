import type { Book, Chapter } from '$lib/types';
import { generateId } from '$lib/utils/file-validation';

/**
 * Converts an image blob to base64 data URL
 */
async function imageToBase64(blob: Blob, mimeType: string): Promise<string> {
        return new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve(reader.result as string);
                reader.onerror = reject;
                reader.readAsDataURL(new Blob([blob], { type: mimeType }));
        });
}

/**
 * Cleans and formats markdown content for better readability
 */
function cleanMarkdown(markdown: string): string {
        return markdown
                // Remove excessive blank lines (more than 2 consecutive)
                .replace(/\n{4,}/g, '\n\n')
                // Normalize single newlines to double for proper paragraph breaks
                .replace(/([^\n])\n([^\n])/g, '$1\n\n$2')
                // But don't double up already doubled newlines
                .replace(/\n{3,}/g, '\n\n')
                // Ensure proper spacing after headings
                .replace(/^(#{1,6}\s+.+)$/gm, '$1\n')
                // Ensure proper spacing around lists
                .replace(/([^\n])\n([*\-+]\s)/g, '$1\n\n$2')
                // Ensure proper spacing around blockquotes
                .replace(/([^\n])\n(>\s)/g, '$1\n\n$2')
                // Clean up whitespace
                .trim();
}

export async function parseEpub(file: File): Promise<Omit<Book, 'id' | 'uploadDate'>> {
        try {
                const [{ default: ePub }, { default: TurndownService }] = await Promise.all([
                        import('epubjs'),
                        import('turndown')
                ]);

                const turndownService = new TurndownService({
                        headingStyle: 'atx',
                        codeBlockStyle: 'fenced',
                        hr: '---',
                        bulletListMarker: '-',
                        emDelimiter: '*',
                        strongDelimiter: '**'
                });

                // Add rule for better image handling
                turndownService.addRule('images', {
                        filter: 'img',
                        replacement: function (content, node: any) {
                                const alt = node.getAttribute('alt') || '';
                                const src = node.getAttribute('src') || '';
                                const title = node.getAttribute('title') || '';
                                
                                if (!src) return '';
                                
                                const titlePart = title ? ` "${title}"` : '';
                                return `\n\n![${alt}](${src}${titlePart})\n\n`;
                        }
                });

		// Add rule for better paragraph spacing (single newline between paragraphs)
		turndownService.addRule('paragraphs', {
			filter: 'p',
			replacement: function (content) {
				const trimmed = content.trim();
				return trimmed ? '\n' + trimmed + '\n' : '';
			}
		});

		// Add rule for converting internal EPUB links to anchor links
		turndownService.addRule('internalLinks', {
			filter: function (node: any) {
				return (
					node.nodeName === 'A' &&
					node.getAttribute('href')
				);
			},
			replacement: function (content, node: any) {
				const href = node.getAttribute('href') || '';
				const text = content.trim() || '';
				
				// Check if this is an internal EPUB link
				const isInternalLink = 
					href.includes('.xhtml') ||
					href.includes('.html') ||
					href.startsWith('#');
				
				if (isInternalLink) {
					// Extract the anchor ID from the href
					// For hrefs like "brw-richman-0004.xhtml#rch05", extract "#rch05"
					// For hrefs like "#rch05", use as-is
					let anchorId = '';
					
					if (href.includes('#')) {
						anchorId = '#' + href.split('#')[1];
					}
					
					// If we have an anchor ID, create an HTML anchor link
					// Otherwise, just return the text content
					if (anchorId) {
						return `<a href="${anchorId}">${text}</a>`;
					} else {
						return text;
					}
				} else {
					// External link - preserve as markdown
					const title = node.getAttribute('title');
					const titlePart = title ? ` "${title}"` : '';
					return `[${text}](${href}${titlePart})`;
				}
			}
		});

		const arrayBuffer = await file.arrayBuffer();
                const book = ePub(arrayBuffer);

                await book.ready;

                const metadata = await book.loaded.metadata;
                const navigation = await book.loaded.navigation;

                const title = metadata.title || file.name.replace(/\.epub$/i, '');
                const author = metadata.creator || undefined;

                const chapters: Chapter[] = [];
                let fullMarkdown = '';
                const imageCache = new Map<string, string>();

		const spine = await book.loaded.spine;
		const spineItems = (spine as any).items;

		// Log available files in the archive for debugging
		try {
			const archiveFiles = Object.keys(book.archive.urlCache || {});
			if (archiveFiles.length > 0) {
				console.log('📚 EPUB Archive Contents:', archiveFiles);
				// Also log image files specifically
				const imageFiles = archiveFiles.filter(f => 
					/\.(jpg|jpeg|png|gif|webp|svg)$/i.test(f)
				);
				if (imageFiles.length > 0) {
					console.log('🖼️  Image files found:', imageFiles);
				}
			}
		} catch (e) {
			console.warn('Could not access archive contents:', e);
		}

		// Extract cover image if available
		let coverImage: string | undefined;
		try {
			const cover = await book.coverUrl();
			if (cover) {
				const response = await fetch(cover);
				const blob = await response.blob();
				coverImage = await imageToBase64(blob, blob.type);
			}
		} catch (error) {
			console.log('No cover image found');
		}

		for (let i = 0; i < spineItems.length; i++) {
			const item = spineItems[i];
			try {
				const doc: any = await book.load(item.href);
				const content = doc.body || doc.documentElement;
				
				// Process images in the content
				const images = content.querySelectorAll('img');
				console.log(`📄 Chapter ${i + 1} (${item.href}): Found ${images.length} images`);
				for (const img of images) {
					const src = img.getAttribute('src');
					if (src && !src.startsWith('data:') && !src.startsWith('http')) {
						try {
							// Check cache first
							if (!imageCache.has(src)) {
								console.log(`Processing image: ${src} (from chapter: ${item.href})`);
								
								// Determine MIME type from extension
								const ext = src.split('.').pop()?.toLowerCase() || '';
								const mimeType = 
									ext === 'png' ? 'image/png' :
									ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' :
									ext === 'gif' ? 'image/gif' :
									ext === 'webp' ? 'image/webp' :
									ext === 'svg' ? 'image/svg+xml' :
									'image/jpeg';
								
								// Try multiple path resolution strategies
								const pathsToTry = new Set<string>();
								
								// Add original path first
								pathsToTry.add(src);
								
								// Get the directory of the current item
								const itemDir = item.href.includes('/') 
									? item.href.substring(0, item.href.lastIndexOf('/'))
									: '';
								
								console.log(`  Chapter directory: ${itemDir || '(root)'}`);
								
								// Strategy 1: Resolve relative to current item
								if (src.startsWith('../')) {
									// Go up directories
									const upLevels = (src.match(/\.\.\//g) || []).length;
									const relativePath = src.replace(/^(\.\.\/)+/, '');
									const itemDirParts = itemDir.split('/').filter(p => p);
									const resolvedDirParts = itemDirParts.slice(0, Math.max(0, itemDirParts.length - upLevels));
									const resolvedPath = resolvedDirParts.length > 0 
										? `${resolvedDirParts.join('/')}/${relativePath}`
										: relativePath;
									pathsToTry.add(resolvedPath);
								} else if (src.startsWith('./')) {
									// Current directory
									const relativePath = src.substring(2);
									pathsToTry.add(itemDir ? `${itemDir}/${relativePath}` : relativePath);
								} else if (!src.startsWith('/')) {
									// Relative path without prefix - resolve relative to current chapter
									if (itemDir) {
										pathsToTry.add(`${itemDir}/${src}`);
									}
								}
								
								// Strategy 2: Try with common EPUB prefixes for the full path
								if (!src.startsWith('OEBPS/')) {
									pathsToTry.add(`OEBPS/${src}`);
								}
								if (!src.startsWith('OPS/')) {
									pathsToTry.add(`OPS/${src}`);
								}
								if (!src.startsWith('EPUB/')) {
									pathsToTry.add(`EPUB/${src}`);
								}
								
								// Strategy 3: Try common content directory names
								const contentDirs = ['OEBPS', 'OPS', 'EPUB', 'content', 'Content', 'book', 'Book'];
								for (const dir of contentDirs) {
									pathsToTry.add(`${dir}/${src}`);
								}
								
								// Strategy 4: Try common EPUB image directories with just the filename
								const filename = src.split('/').pop() || src;
								if (filename !== src) {
									// Only try these if src contains a path
									const imageDirs = ['images', 'Images', 'image', 'Image', 'img', 'Img', 'media', 'Media'];
									for (const imgDir of imageDirs) {
										pathsToTry.add(`${imgDir}/${filename}`);
										for (const contentDir of contentDirs) {
											pathsToTry.add(`${contentDir}/${imgDir}/${filename}`);
										}
									}
								}
								
								// Strategy 5: Try without leading slash
								if (src.startsWith('/')) {
									pathsToTry.add(src.substring(1));
								}
								
								// Strategy 6: Try all files in archive that match the filename
								// This is a fallback to find the image anywhere in the archive
								try {
									const archiveFiles = Object.keys(book.archive.urlCache || {});
									const matchingFiles = archiveFiles.filter(f => f.endsWith(filename));
									matchingFiles.forEach(f => {
										pathsToTry.add(f);
										// Also try without leading slash
										if (f.startsWith('/')) {
											pathsToTry.add(f.substring(1));
										}
									});
								} catch (e) {
									// Ignore if we can't access archive
								}
								
								console.log(`  Will try ${pathsToTry.size} paths:`, Array.from(pathsToTry));
								
								let imageLoaded = false;
								const attemptedPaths: string[] = [];
								
								for (const pathToTry of pathsToTry) {
									if (imageLoaded) break;
									attemptedPaths.push(pathToTry);
									
									try {
										// Method 1: Try archive.getBase64 (most reliable for epub.js)
										try {
											const base64Data = await book.archive.getBase64(pathToTry);
											if (base64Data) {
												// Check if the data already includes the data URL prefix
												let base64Url: string;
												if (base64Data.startsWith('data:')) {
													// Already has the prefix, use as-is
													base64Url = base64Data;
												} else {
													// Add the prefix
													base64Url = `data:${mimeType};base64,${base64Data}`;
												}
												imageCache.set(src, base64Url);
												img.setAttribute('src', base64Url);
												console.log(`✓ Image loaded: ${src} → ${pathToTry}`);
												imageLoaded = true;
												break;
											}
										} catch (e1) {
											// Try next method
										}
										
										// Method 2: Try book.load with resolved URL
										try {
											const resolvedUrl = book.resolve(pathToTry, item.href);
											const imageData = await book.load(resolvedUrl);
											
											let blob: Blob;
											if (imageData instanceof Blob) {
												blob = imageData;
											} else if (imageData instanceof ArrayBuffer) {
												blob = new Blob([imageData], { type: mimeType });
											} else if (typeof imageData === 'string' && imageData.startsWith('blob:')) {
												// It's a blob URL, fetch it
												const response = await fetch(imageData);
												blob = await response.blob();
											} else {
												throw new Error('Unsupported image data type');
											}
											
											const base64Url = await imageToBase64(blob, mimeType);
											imageCache.set(src, base64Url);
											img.setAttribute('src', base64Url);
											console.log(`✓ Image loaded: ${src} → ${resolvedUrl}`);
											imageLoaded = true;
											break;
										} catch (e2) {
											// Try next path
										}
									} catch (error) {
										// Try next path
									}
								}
								
								if (!imageLoaded) {
									console.error(`✗ Failed to load image: ${src}`);
									console.error(`  Attempted paths:`, attemptedPaths);
								}
							} else {
								// Use cached image
								const cachedImage = imageCache.get(src);
								if (cachedImage) {
									img.setAttribute('src', cachedImage);
									console.log(`✓ Using cached image: ${src}`);
								}
							}
						} catch (error) {
							console.error(`Error processing image ${src}:`, error);
						}
					}
				}
				
				// Verify images were updated
				const updatedImages = content.querySelectorAll('img');
				let dataUrlCount = 0;
				updatedImages.forEach((img: any) => {
					const src = img.getAttribute('src');
					if (src?.startsWith('data:')) {
						dataUrlCount++;
					}
				});
				console.log(`✓ Chapter ${i + 1}: ${dataUrlCount}/${images.length} images converted to data URLs`);
				
				const html = content.innerHTML;
				let markdown = turndownService.turndown(html);
				markdown = cleanMarkdown(markdown);

                                const chapterTitle =
                                        navigation.toc[i]?.label || item.id || `Chapter ${i + 1}`;

                                const chapter: Chapter = {
                                        id: generateId(),
                                        title: chapterTitle,
                                        content: markdown,
                                        level: 1,
                                        order: i
                                };

                                chapters.push(chapter);
                                fullMarkdown += `\n\n# ${chapterTitle}\n\n${markdown}\n\n---\n`;
                        } catch (error) {
                                console.error(`Error parsing chapter ${i}:`, error);
                                // Continue with other chapters
                        }
                }

                if (chapters.length === 0) {
                        throw new Error('No readable content found in EPUB file');
                }

                return {
                        title,
                        author,
                        format: 'epub',
                        progress: 0,
                        markdown: cleanMarkdown(fullMarkdown),
                        chapters,
                        lastRead: undefined,
                        coverImage
                };
        } catch (error) {
                console.error('EPUB parsing error:', error);
                throw new Error(`Failed to parse EPUB file: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
}
