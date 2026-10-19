/** 嵌入助手与独立 Web 默认主色（Ant Design `colorPrimary`） */
export const DEFAULT_ASSISTANT_COLOR_PRIMARY = "#1677ff";

export interface AssistantColorTheme {
  colorPrimary?: string;
}

export function resolveAssistantColorPrimary(theme?: AssistantColorTheme): string {
  const value = theme?.colorPrimary?.trim();
  return value && value.length > 0 ? value : DEFAULT_ASSISTANT_COLOR_PRIMARY;
}
