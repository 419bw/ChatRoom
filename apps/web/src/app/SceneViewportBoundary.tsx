import {
  Component,
  type ErrorInfo,
  type PropsWithChildren,
  type ReactNode,
} from "react";

type SceneViewportBoundaryProps = PropsWithChildren<{
  resetKey: string;
}>;

type SceneViewportBoundaryState = {
  hasError: boolean;
};

export class SceneViewportBoundary extends Component<
  SceneViewportBoundaryProps,
  SceneViewportBoundaryState
> {
  state: SceneViewportBoundaryState = {
    hasError: false,
  };

  static getDerivedStateFromError() {
    return {
      hasError: true,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("[scene3d] 3D 视口渲染失败", error, errorInfo);
    if (
      error.message.includes("avatar-formal.glb") ||
      error.message.includes("reading 'input'")
    ) {
      console.error("[scene3d] 正式角色模型结构异常，请重新生成 avatar-formal.glb");
    }
  }

  componentDidUpdate(previousProps: SceneViewportBoundaryProps) {
    if (previousProps.resetKey !== this.props.resetKey && this.state.hasError) {
      this.setState({
        hasError: false,
      });
    }
  }

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div className="room-viewport room-viewport--shell room-viewport--error">
          <div className="room-viewport__error-card">
            <strong>3D 场景加载失败</strong>
            <span>请刷新页面后重试，若仍失败请查看控制台日志。</span>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
