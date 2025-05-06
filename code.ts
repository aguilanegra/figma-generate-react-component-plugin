figma.showUI(__html__, {
  width: 450,
  height: 600,
});

interface ComponentStyle {
  backgroundColor?: string;
  borderColor?: string;
  borderWidth?: string;
  borderRadius?: string;
  boxShadow?: string;
  fontSize?: string;
  fontWeight?: number;
  fontFamily?: string;
  color?: string;
  lineHeight?: string;
  width?: string;
  height?: string;
  paddingLeft?: string;
  paddingRight?: string;
  paddingTop?: string;
  paddingBottom?: string;
}

interface ComponentStateStyles {
  hover: ComponentStyle;
  focus: ComponentStyle;
  active: ComponentStyle;
  disabled: ComponentStyle;
}

interface ComponentVariant {
  id: string;
  name: string;
  description: string;
}

interface PropDefinition {
  type: string;
  defaultValue: string | number | boolean | null;
}

interface ComponentProps {
  [key: string]: PropDefinition;
}

interface ComponentData {
  id: string;
  name: string;
  description: string;
  type: string;
  styles: ComponentStyle;
  states: ComponentStateStyles;
  variants: ComponentVariant[];
  properties: ComponentProps;
}

figma.ui.onmessage = async (msg) => {
  if (msg.type === 'generate-component') {
    const selection = figma.currentPage.selection;

    if (selection.length === 0) {
      figma.ui.postMessage({
        type: 'error',
        message: 'Please select a component to convert',
      });
      return;
    }

    if (selection.length > 1) {
      figma.ui.postMessage({
        type: 'error',
        message: 'Please select only one component at a time',
      });
      return;
    }

    const node = selection[0];

    // Check if the selected node is a component or instance
    if (node.type !== 'COMPONENT' && node.type !== 'INSTANCE') {
      figma.ui.postMessage({
        type: 'error',
        message: 'Selected node must be a component or component instance',
      });
      return;
    }

    try {
      // Detect component type
      const componentType = detectComponentType(node);

      // Extract component properties
      const componentData = await extractComponentData(node, componentType);

      // Send the data to the UI for code generation
      figma.ui.postMessage({
        type: 'component-data',
        componentType,
        componentData,
      });
    } catch (error) {
      figma.ui.postMessage({
        type: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'Failed to extract component data',
      });
    }
  }

  if (msg.type === 'close-plugin') {
    figma.closePlugin();
  }
};

// Detect component type based on name and properties
function detectComponentType(node: ComponentNode | InstanceNode): string {
  const name = node.name.toLowerCase();

  // Detect by name patterns
  if (name.includes('button')) return 'button';
  if (name.includes('input') || name.includes('text field')) return 'input';
  if (name.includes('card')) return 'card';
  if (name.includes('dropdown') || name.includes('select')) return 'dropdown';
  if (name.includes('modal') || name.includes('dialog')) return 'modal';
  if (name.includes('toggle') || name.includes('switch')) return 'toggle';
  if (name.includes('checkbox')) return 'checkbox';
  if (name.includes('radio')) return 'radio';
  return 'generic';
}

// Extract all relevant data from the component
async function extractComponentData(
  node: ComponentNode | InstanceNode,
  componentType: string
): Promise<ComponentData> {
  const variants: ComponentVariant[] = [];

  if (node.type === 'COMPONENT') {
    const parent = node.parent;
    if (parent && parent.type === 'COMPONENT_SET') {
      // This is part of a component set, get all variants
      parent.children.forEach((child) => {
        if (child.type === 'COMPONENT') {
          variants.push({
            id: child.id,
            name: child.name,
            description: 'description' in child ? child.description || '' : '',
          });
        }
      });
    }
  }

  // Extract styles based on component type
  const baseStyles = extractStyles(node);

  // Get component states if available
  const states = await extractStates(node);

  // Get component properties
  const properties = extractProperties(node);

  return {
    id: node.id,
    name: node.name,
    description: 'description' in node ? node.description || '' : '',
    type: componentType,
    styles: baseStyles,
    states,
    variants,
    properties,
  };
}

// Extract style information
function extractStyles(node: SceneNode): ComponentStyle {
  const styles: ComponentStyle = {};

  // Process all visible properties
  if ('fills' in node && node.fills && node.fills !== figma.mixed) {
    styles.backgroundColor = processColor(node.fills);
  }

  if ('strokes' in node && node.strokes && Array.isArray(node.strokes)) {
    styles.borderColor = processColor(node.strokes);
  }

  if ('strokeWeight' in node && node.strokeWeight !== figma.mixed) {
    styles.borderWidth = `${node.strokeWeight}px`;
  }

  if ('cornerRadius' in node && node.cornerRadius !== figma.mixed) {
    styles.borderRadius = `${node.cornerRadius}px`;
  }

  if ('effects' in node && node.effects && Array.isArray(node.effects)) {
    styles.boxShadow = processEffects(node.effects);
  }

  // Extract text properties if available
  if (node.type === 'TEXT') {
    if (node.fontSize !== figma.mixed) styles.fontSize = `${node.fontSize}px`;
    if (node.fontWeight !== figma.mixed) styles.fontWeight = node.fontWeight;

    // Use proper type checking for TextNode properties
    const textNode = node as TextNode;
    if ('fontFamily' in textNode && textNode.fontFamily !== figma.mixed) {
      // Convert the unknown type to string with a type assertion
      styles.fontFamily = String(textNode.fontFamily);
    }

    if (node.fills !== figma.mixed) styles.color = processColor(node.fills);

    if (
      node.lineHeight !== figma.mixed &&
      typeof node.lineHeight === 'object'
    ) {
      const lineHeight = node.lineHeight;
      if ('unit' in lineHeight && 'value' in lineHeight) {
        styles.lineHeight = `${
          lineHeight.value
        }${lineHeight.unit.toLowerCase()}`;
      }
    }
  }

  // Get dimensions
  if ('width' in node) styles.width = `${Math.round(node.width)}px`;
  if ('height' in node) styles.height = `${Math.round(node.height)}px`;

  // Get padding if applicable
  if ('paddingLeft' in node && typeof node.paddingLeft === 'number') {
    styles.paddingLeft = `${node.paddingLeft}px`;
  }
  if ('paddingRight' in node && typeof node.paddingRight === 'number') {
    styles.paddingRight = `${node.paddingRight}px`;
  }
  if ('paddingTop' in node && typeof node.paddingTop === 'number') {
    styles.paddingTop = `${node.paddingTop}px`;
  }
  if ('paddingBottom' in node && typeof node.paddingBottom === 'number') {
    styles.paddingBottom = `${node.paddingBottom}px`;
  }

  return styles;
}

// Process color data
function processColor(fills: ReadonlyArray<Paint>): string {
  if (fills.length === 0) return 'transparent';

  // We'll just use the first fill for simplicity
  const fill = fills[0];

  if (fill.type === 'SOLID') {
    const { r, g, b } = fill.color;
    const opacity = 'opacity' in fill ? fill.opacity : 1;
    return `rgba(${Math.round(r * 255)}, ${Math.round(g * 255)}, ${Math.round(
      b * 255
    )}, ${opacity})`;
  }

  return 'transparent';
}

// Process effects like shadows
function processEffects(effects: ReadonlyArray<Effect>): string {
  const shadows = effects.filter((effect) => effect.type === 'DROP_SHADOW');

  if (shadows.length === 0) return 'none';

  return shadows
    .map((shadow) => {
      if (shadow.type === 'DROP_SHADOW') {
        const { color, offset, radius } = shadow;
        const rgba = `rgba(${Math.round(color.r * 255)}, ${Math.round(
          color.g * 255
        )}, ${Math.round(color.b * 255)}, ${color.a})`;
        return `${offset.x}px ${offset.y}px ${radius}px ${rgba}`;
      }
      return '';
    })
    .join(', ');
}

// Extract component states (hover, focus, etc)
async function extractStates(
  node: ComponentNode | InstanceNode
): Promise<ComponentStateStyles> {
  // This is a simplified approach. In a real plugin, you'd need a more sophisticated method
  // to detect states, possibly using component variants or layer names

  const states: ComponentStateStyles = {
    hover: {},
    focus: {},
    active: {},
    disabled: {},
  };

  // Example: Look for variant components with state names in a component set
  if (node.type === 'COMPONENT') {
    const parent = node.parent;
    if (parent && parent.type === 'COMPONENT_SET') {
      // Look for variants with state names
      for (const child of parent.children) {
        if (child.type === 'COMPONENT') {
          const name = child.name.toLowerCase();

          if (name.includes('hover')) {
            states.hover = extractStyles(child);
          } else if (name.includes('focus')) {
            states.focus = extractStyles(child);
          } else if (name.includes('active') || name.includes('pressed')) {
            states.active = extractStyles(child);
          } else if (name.includes('disabled')) {
            states.disabled = extractStyles(child);
          }
        }
      }
    }
  }

  // If no states were found through variants, use common style transformations
  // These are just common patterns - actual implementation would need refinement
  if (Object.keys(states.hover).length === 0) {
    // Common hover effects
    const baseStyles = extractStyles(node);
    if (
      baseStyles.backgroundColor &&
      baseStyles.backgroundColor !== 'transparent'
    ) {
      // Darken background color slightly for hover
      states.hover.backgroundColor = darkenColor(
        baseStyles.backgroundColor,
        0.1
      );
    }
  }

  return states;
}

// Utility to darken a color by a factor
function darkenColor(color: string, factor: number): string {
  // Simple implementation - would need proper color manipulation in a real plugin
  if (color.startsWith('rgba(')) {
    const parts = color.replace('rgba(', '').replace(')', '').split(',');
    const r = Math.max(0, parseInt(parts[0].trim()) - Math.round(255 * factor));
    const g = Math.max(0, parseInt(parts[1].trim()) - Math.round(255 * factor));
    const b = Math.max(0, parseInt(parts[2].trim()) - Math.round(255 * factor));
    const a = parseFloat(parts[3].trim());
    return `rgba(${r}, ${g}, ${b}, ${a})`;
  }
  return color;
}

// Extract component properties (props)
function extractProperties(node: ComponentNode | InstanceNode): ComponentProps {
  const props: ComponentProps = {};

  // Extract component properties
  if ('componentProperties' in node && node.componentProperties) {
    // Process each component property
    for (const key in node.componentProperties) {
      if (Object.prototype.hasOwnProperty.call(node.componentProperties, key)) {
        const value = node.componentProperties[key];

        // Use string type by default
        let propType = 'string';

        // Try to determine more specific type
        if (value.type === 'BOOLEAN') propType = 'boolean';
        else if (value.type === 'VARIANT') propType = 'enum';
        else if (typeof value.value === 'number') propType = 'number';

        // Create the property definition
        props[key] = {
          type: propType,
          defaultValue:
            typeof value.value === 'string' || typeof value.value === 'boolean'
              ? value.value
              : null,
        };
      }
    }
  }

  // Add common props based on component type
  const name = node.name.toLowerCase();

  if (name.includes('button')) {
    props.onClick = { type: 'function', defaultValue: null };
    props.disabled = { type: 'boolean', defaultValue: false };
  }

  if (name.includes('input')) {
    props.value = { type: 'string', defaultValue: '' };
    props.onChange = { type: 'function', defaultValue: null };
    props.placeholder = { type: 'string', defaultValue: '' };
    props.disabled = { type: 'boolean', defaultValue: false };
  }

  return props;
}
