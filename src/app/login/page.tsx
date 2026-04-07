"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, Chip, Input, Spinner, Toast } from "@heroui/react";

type MascotMode =
  | "idle"
  | "focus-user"
  | "peek-password"
  | "privacy"
  | "confused"
  | "celebrate";

function getMascotMessage(mode: MascotMode) {
  if (mode === "focus-user") return "我在认真核对账号";
  if (mode === "peek-password") return "我只是瞄一眼密码输入进度";
  if (mode === "privacy") return "收到，不看密码，我把眼睛捂上";
  if (mode === "confused") return "好像有点不对，再检查一下账号密码？";
  if (mode === "celebrate") return "登录成功，今天也一起把库存管得明明白白";
  return "欢迎回来，开始今天的库存管理";
}

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [privacyMode, setPrivacyMode] = useState(false);
  const [usernameFocused, setUsernameFocused] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);
  const [successFlash, setSuccessFlash] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  let mascotMode: MascotMode = "idle";
  if (successFlash) mascotMode = "celebrate";
  else if (error) mascotMode = "confused";
  else if (passwordFocused && privacyMode) mascotMode = "privacy";
  else if (passwordFocused) mascotMode = "peek-password";
  else if (usernameFocused) mascotMode = "focus-user";

  const pupilTransform =
    mascotMode === "peek-password"
      ? "translate(5px, 2px)"
      : mascotMode === "focus-user"
        ? "translate(-3px, 1px)"
        : "translate(0px, 0px)";

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      const data = (await response.json()) as { message?: string };

      if (!response.ok) {
        const message = data.message ?? "登录失败";
        setError(message);
        Toast.toast.danger(message);
        return;
      }

      setSuccessFlash(true);
      sessionStorage.setItem("warehouse_last_password", password);
      Toast.toast.success("登录成功，欢迎回来");
      await new Promise((resolve) => setTimeout(resolve, 700));
      router.replace("/dashboard");
      router.refresh();
    } catch {
      const message = "网络异常，请稍后重试";
      setError(message);
      Toast.toast.danger(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-zinc-100 px-4 py-8 text-zinc-900">
      <div className="login-bg-grid pointer-events-none absolute inset-0" />
      <div className="login-orb login-orb-1 pointer-events-none" />
      <div className="login-orb login-orb-2 pointer-events-none" />
      <div className="login-orb login-orb-3 pointer-events-none" />

      <div className="mx-auto grid min-h-[calc(100vh-4rem)] w-full max-w-7xl grid-cols-1 gap-4 lg:grid-cols-2">
        <Card className="relative hidden overflow-hidden border border-zinc-200/70 bg-white/85 shadow-lg lg:flex">
          <Card.Content className="flex h-full flex-col justify-between p-8">
            <div className="pointer-events-none absolute -right-20 -top-20 h-56 w-56 rounded-full bg-zinc-200/50 blur-3xl" />
            <div className="pointer-events-none absolute -left-16 bottom-0 h-64 w-64 rounded-full bg-zinc-300/30 blur-3xl" />

            <div>
              <Chip size="sm" variant="soft" color="default">
                Warehouse Admin
              </Chip>
              <h1 className="mt-4 text-3xl font-semibold leading-tight text-zinc-900">
                酒店仓库管理后台
              </h1>
              <p className="mt-3 max-w-md text-sm leading-7 text-zinc-600">
                一个专为小型仓库场景打造的轻量管理系统，帮助你清晰掌握库存状态，减少人工记录负担。
              </p>
            </div>

            <div className="relative mt-6 rounded-2xl border border-zinc-200 bg-white/70 p-5 shadow-sm">
              <div className="flex items-start gap-4">
                <div className="mascot-wrap">
                  <div className={`mascot-head ${mascotMode === "confused" ? "is-confused" : ""} ${mascotMode === "celebrate" ? "is-celebrate" : ""}`}>
                    {mascotMode === "confused" ? (
                      <>
                        <span className="mascot-brow mascot-brow-left" />
                        <span className="mascot-brow mascot-brow-right" />
                      </>
                    ) : null}
                    <div className="mascot-eye">
                      <span
                        className="mascot-pupil"
                        style={{ transform: pupilTransform }}
                      />
                    </div>
                    <div className="mascot-eye">
                      <span
                        className="mascot-pupil"
                        style={{ transform: pupilTransform }}
                      />
                    </div>

                    {mascotMode === "privacy" ? (
                      <>
                        <span className="mascot-hand mascot-hand-left" />
                        <span className="mascot-hand mascot-hand-right" />
                      </>
                    ) : null}
                    {mascotMode === "celebrate" ? (
                      <>
                        <span className="mascot-spark mascot-spark-1" />
                        <span className="mascot-spark mascot-spark-2" />
                        <span className="mascot-spark mascot-spark-3" />
                      </>
                    ) : null}
                  </div>
                  <div className="mascot-body" />
                </div>

                <div className="min-w-0">
                  <p className="text-sm font-medium text-zinc-800">智能值守小助手</p>
                  <p className="mt-1 text-xs leading-6 text-zinc-600">
                    {getMascotMessage(mascotMode)}
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3">
                <p className="text-sm font-medium text-zinc-800">实时库存可视化</p>
                <p className="mt-1 text-xs text-zinc-500">
                  按商品和分类快速查看当前库存、低库存和缺货状态。
                </p>
              </div>
              <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3">
                <p className="text-sm font-medium text-zinc-800">完整变动留痕</p>
                <p className="mt-1 text-xs text-zinc-500">
                  每次入库、出库、盘点调整都自动记录，便于回查与核对。
                </p>
              </div>
              <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3">
                <p className="text-sm font-medium text-zinc-800">低学习成本</p>
                <p className="mt-1 text-xs text-zinc-500">
                  页面结构直观、操作步骤少，适合个人或 3 人以内协作使用。
                </p>
              </div>
            </div>
          </Card.Content>
        </Card>

        <Card className="border border-zinc-200/70 bg-white shadow-xl">
          <Card.Content className="flex h-full flex-col justify-center p-6 sm:p-10">
            <div className="mb-6">
              <h2 className="text-2xl font-semibold">登录系统</h2>
              <p className="mt-1 text-sm text-zinc-500">请输入账号信息进入后台。</p>
            </div>

            <form className="space-y-4" onSubmit={handleSubmit}>
              <div className="space-y-1">
                <p className="text-sm text-zinc-600">用户名</p>
                <Input
                  aria-label="用户名"
                  placeholder="请输入用户名"
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  onFocus={() => setUsernameFocused(true)}
                  onBlur={() => setUsernameFocused(false)}
                  autoComplete="username"
                  required
                />
              </div>

              <div className="space-y-1">
                <p className="text-sm text-zinc-600">密码</p>
                <Input
                  aria-label="密码"
                  placeholder="请输入密码"
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  onFocus={() => setPasswordFocused(true)}
                  onBlur={() => setPasswordFocused(false)}
                  autoComplete="current-password"
                  required
                />
              </div>

              <label className="flex items-center gap-2 text-xs text-zinc-600">
                <input
                  type="checkbox"
                  checked={privacyMode}
                  onChange={(event) => setPrivacyMode(event.target.checked)}
                  className="h-4 w-4 rounded border-zinc-300"
                />
                输入密码时不让小助手偷看
              </label>

              <Button
                type="submit"
                fullWidth
                className="bg-zinc-900 text-white hover:bg-zinc-700"
                isDisabled={loading}
              >
                {loading ? (
                  <span className="inline-flex items-center gap-2">
                    <Spinner size="sm" color="current" />
                    登录中...
                  </span>
                ) : successFlash ? (
                  "登录成功"
                ) : (
                  "登录"
                )}
              </Button>
            </form>

            <p className="mt-6 text-xs text-zinc-500">
              默认管理员账号请尽快修改初始密码，确保系统安全。
            </p>
          </Card.Content>
        </Card>
      </div>
    </main>
  );
}
